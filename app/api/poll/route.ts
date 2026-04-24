/**
 * Background polling endpoint — polls both BCH and BTC independently.
 * Reads settings from disk, fires Discord alerts server-side so alerts
 * work even when no browser tab is open.
 */
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { loadSettings } from '../settings/route'

const DATA_DIR   = process.env.SETTINGS_DIR ?? '/data'
const STATE_FILE = join(DATA_DIR, 'poll-state.json')

interface CoinState {
  prevBestSinceBlock:    number
  prevBlockHeight:       number
  netDiffCrossedAlerted: boolean
  milestoneAlerted:      number[]
  milestoneBlock:        number   // block height when milestones were last reset
}

interface PollState {
  bch: CoinState
  btc: CoinState
}

function emptyCoin(): CoinState {
  return {
    prevBestSinceBlock:    0,
    prevBlockHeight:       0,
    netDiffCrossedAlerted: false,
    milestoneAlerted:      [],
    milestoneBlock:        0,
  }
}

function loadState(): PollState {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as Partial<PollState>
      return {
        bch: raw.bch ?? emptyCoin(),
        btc: raw.btc ?? emptyCoin(),
      }
    }
  } catch { /* ignore */ }
  return { bch: emptyCoin(), btc: emptyCoin() }
}

function saveState(s: PollState): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(s), 'utf-8')
  } catch { /* ignore */ }
}

async function sendDiscord(webhookUrl: string, payload: object): Promise<void> {
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* silently ignore */ }
}

function blockCandidateEmbed(coin: string, workerName: string, bestShare: string, netDiff: string, height: number) {
  return {
    embeds: [{
      title: `[${coin}] BLOCK CANDIDATE — Share >= Network Difficulty`,
      description: `**${workerName}** submitted a share that meets or exceeds the network difficulty!`,
      color: 0x22c55e,
      fields: [
        { name: 'Coin',               value: coin,       inline: true },
        { name: 'Worker',             value: workerName, inline: true },
        { name: 'Share Difficulty',   value: bestShare,  inline: true },
        { name: 'Network Difficulty', value: netDiff,    inline: true },
        { name: 'Block Height',       value: `#${height}`, inline: true },
      ],
      footer: { text: 'Axe Mining Dashboard' },
      timestamp: new Date().toISOString(),
    }],
  }
}

function newBestEmbed(coin: string, workerName: string, bestShare: string, netDiff: string) {
  return {
    embeds: [{
      title: `[${coin}] New Best Share Since Block`,
      description: `**${workerName}** set a new best share for this round.`,
      color: 0xf7931a,
      fields: [
        { name: 'Coin',               value: coin,       inline: true },
        { name: 'Worker',             value: workerName, inline: true },
        { name: 'Share Difficulty',   value: bestShare,  inline: true },
        { name: 'Network Difficulty', value: netDiff,    inline: true },
      ],
      footer: { text: 'Axe Mining Dashboard' },
      timestamp: new Date().toISOString(),
    }],
  }
}

function milestoneEmbed(coin: string, pct: number, etaDays: number, etaHours: number, height: number) {
  return {
    embeds: [{
      title: `[${coin}] ${pct}% Progress Towards Block`,
      description: `Making good progress towards block **#${height + 1}**.`,
      color: 0x3b82f6,
      fields: [
        { name: 'Coin',     value: coin,                         inline: true },
        { name: 'Progress', value: `${pct}%`,                   inline: true },
        { name: 'ETA',      value: `${etaDays}d ${etaHours}h`,  inline: true },
      ],
      footer: { text: 'Axe Mining Dashboard' },
      timestamp: new Date().toISOString(),
    }],
  }
}

function fmtDiff(raw: number): string {
  if (raw >= 1e12) return `${(raw / 1e12).toFixed(2)} T`
  if (raw >= 1e9)  return `${(raw / 1e9).toFixed(2)} G`
  if (raw >= 1e6)  return `${(raw / 1e6).toFixed(2)} M`
  return `${raw.toFixed(0)}`
}

const MILESTONES = [25, 50, 75, 90]

async function pollCoin(
  apiUrl: string,
  coin: 'BCH' | 'BTC',
  state: CoinState,
  discord: string,
  alerts: string[],
): Promise<void> {
  if (!apiUrl) return

  const base    = apiUrl.replace(/\/api\/(pool|workers|node)\/?$/, '')
  const poolUrl = `${base}/api/pool`

  let pool: Record<string, unknown>
  try {
    const res = await fetch(poolUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return
    pool = await res.json() as Record<string, unknown>
  } catch {
    return
  }

  // BCH: `best_share_since_block` / `best_share_since_block_worker`
  // BTC: `best_share` / `best_share_worker`
  const bsBlockRaw  = (pool.best_share_since_block as number) ?? (pool.best_share as number) ?? 0
  const netDiffRaw  = (pool.network_difficulty     as number) ?? 0
  const blockHeight = (pool.network_height         as number) ?? 0
  const rawWorkerName =
    (pool.best_share_since_block_worker as string) ??
    (pool.best_share_worker            as string) ?? 'Unknown'
  // Strip wallet address prefix — e.g. "37EiB...MT.S9" → "S9"
  const workerName = rawWorkerName.includes('.')
    ? rawWorkerName.split('.').pop()!
    : rawWorkerName
  const bestShareFmt = fmtDiff(bsBlockRaw)
  const netDiffFmt   = fmtDiff(netDiffRaw)
  const etaSeconds   = (pool.eta_seconds as number) ?? 0
  const etaDays      = Math.floor(etaSeconds / 86400)
  const etaHours     = Math.floor((etaSeconds % 86400) / 3600)
  const progressPct  = netDiffRaw > 0 ? Math.min(100, (bsBlockRaw / netDiffRaw) * 100) : 0

  // Detect new block — reset round state FIRST before any alert checks
  if (blockHeight > 0 && state.prevBlockHeight > 0 && blockHeight !== state.prevBlockHeight) {
    state.netDiffCrossedAlerted = false
    state.milestoneAlerted      = []
    state.milestoneBlock        = blockHeight
    state.prevBestSinceBlock    = 0
  }
  state.prevBlockHeight = blockHeight

  // If block height changed since milestones were last reset, clear them
  if (state.milestoneBlock !== blockHeight) {
    state.milestoneAlerted = []
    state.milestoneBlock   = blockHeight
  }

  // 1. New best share
  if (bsBlockRaw > 0 && bsBlockRaw > state.prevBestSinceBlock && state.prevBestSinceBlock > 0) {
    alerts.push(`[${coin}] new_best:${workerName}:${bestShareFmt}`)
    await sendDiscord(discord, newBestEmbed(coin, workerName, bestShareFmt, netDiffFmt))
  }
  state.prevBestSinceBlock = bsBlockRaw

  // 2. Block candidate
  if (bsBlockRaw > 0 && netDiffRaw > 0 && bsBlockRaw >= netDiffRaw && !state.netDiffCrossedAlerted) {
    state.netDiffCrossedAlerted = true
    alerts.push(`[${coin}] block_candidate:${workerName}`)
    await sendDiscord(discord, blockCandidateEmbed(coin, workerName, bestShareFmt, netDiffFmt, blockHeight))
  }
  if (bsBlockRaw < netDiffRaw * 0.1) {
    state.netDiffCrossedAlerted = false
  }

  // 3. Milestones — keyed to current block height to prevent re-firing
  for (const m of MILESTONES) {
    if (progressPct >= m && !state.milestoneAlerted.includes(m)) {
      state.milestoneAlerted.push(m)
      alerts.push(`[${coin}] milestone:${m}%`)
      await sendDiscord(discord, milestoneEmbed(coin, m, etaDays, etaHours, blockHeight))
    }
  }
}

export async function GET() {
  const settings = loadSettings()
  const state    = loadState()
  const alerts: string[] = []
  const discord  = settings.discordUrl

  await Promise.all([
    pollCoin(settings.apiUrl,    'BCH', state.bch, discord, alerts),
    pollCoin(settings.btcApiUrl, 'BTC', state.btc, discord, alerts),
  ])

  saveState(state)
  return NextResponse.json({ ok: true, alerts })
}
