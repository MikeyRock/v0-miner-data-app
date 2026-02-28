/**
 * Background polling endpoint — called by the client on a timer.
 * Reads settings from disk, fetches /api/pool, checks alert conditions,
 * and fires Discord webhooks server-side so alerts work even if the
 * browser tab is closed (as long as the Next.js server is running).
 */
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { loadSettings } from '../settings/route'

const DATA_DIR   = process.env.SETTINGS_DIR ?? '/data'
const STATE_FILE = join(DATA_DIR, 'poll-state.json')

interface PollState {
  prevBestSinceBlock:    number
  prevBlockHeight:       number
  netDiffCrossedAlerted: boolean
  milestoneAlerted:      number[]
  workerBests:           Record<string, number>
}

function loadState(): PollState {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as PollState
    }
  } catch { /* ignore */ }
  return {
    prevBestSinceBlock:    0,
    prevBlockHeight:       0,
    netDiffCrossedAlerted: false,
    milestoneAlerted:      [],
    workerBests:           {},
  }
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

function blockCandidateEmbed(workerName: string, bestShare: string, netDiff: string, height: number) {
  return {
    embeds: [{
      title: 'BLOCK CANDIDATE — Share >= Network Difficulty',
      description: `**${workerName}** submitted a share that meets or exceeds the network difficulty!`,
      color: 0x22c55e,
      fields: [
        { name: 'Worker',              value: workerName, inline: true },
        { name: 'Share Difficulty',    value: bestShare,  inline: true },
        { name: 'Network Difficulty',  value: netDiff,    inline: true },
        { name: 'Block Height',        value: `#${height}`, inline: true },
      ],
      footer: { text: 'AxeBCH Solo Node' },
      timestamp: new Date().toISOString(),
    }],
  }
}

function newBestEmbed(workerName: string, bestShare: string, netDiff: string) {
  return {
    embeds: [{
      title: 'New Best Share Since Block',
      description: `**${workerName}** set a new best share for this round.`,
      color: 0xf7931a,
      fields: [
        { name: 'Worker',             value: workerName, inline: true },
        { name: 'Share Difficulty',   value: bestShare,  inline: true },
        { name: 'Network Difficulty', value: netDiff,    inline: true },
      ],
      footer: { text: 'AxeBCH Solo Node' },
      timestamp: new Date().toISOString(),
    }],
  }
}

function milestoneEmbed(pct: number, etaDays: number, etaHours: number, height: number) {
  return {
    embeds: [{
      title: `${pct}% Progress Towards Block`,
      description: `Making good progress towards block **#${height + 1}**.`,
      color: 0x3b82f6,
      fields: [
        { name: 'Progress', value: `${pct}%`,                         inline: true },
        { name: 'ETA',      value: `${etaDays}d ${etaHours}h`,        inline: true },
      ],
      footer: { text: 'AxeBCH Solo Node' },
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

export async function GET() {
  const settings = loadSettings()
  if (!settings.apiUrl) {
    return NextResponse.json({ skipped: 'no apiUrl configured' })
  }

  const base      = settings.apiUrl.replace(/\/api\/(pool|workers|node)\/?$/, '')
  const poolUrl   = `${base}/api/pool`

  let pool: Record<string, unknown>
  try {
    const res = await fetch(poolUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return NextResponse.json({ error: `pool returned ${res.status}` })
    pool = await res.json() as Record<string, unknown>
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }

  const state = loadState()
  const alerts: string[] = []
  const discord = settings.discordUrl

  const bsBlockRaw   = (pool.best_share_since_block as number)  ?? 0
  const netDiffRaw   = (pool.network_difficulty      as number)  ?? 0
  const blockHeight  = (pool.network_height           as number)  ?? 0
  const workerName   = (pool.best_share_since_block_worker as string) ?? 'Unknown'
  const bestShareFmt = fmtDiff(bsBlockRaw)
  const netDiffFmt   = fmtDiff(netDiffRaw)

  // Progress
  const progressPercent = netDiffRaw > 0
    ? Math.min(100, (bsBlockRaw / netDiffRaw) * 100)
    : 0

  // ETA
  const etaSeconds = (pool.eta_seconds as number) ?? 0
  const etaDays    = Math.floor(etaSeconds / 86400)
  const etaHours   = Math.floor((etaSeconds % 86400) / 3600)

  // 1. New best share since block
  if (bsBlockRaw > 0 && bsBlockRaw > state.prevBestSinceBlock && state.prevBestSinceBlock > 0) {
    alerts.push(`new_best:${workerName}:${bestShareFmt}`)
    await sendDiscord(discord, newBestEmbed(workerName, bestShareFmt, netDiffFmt))
  }
  state.prevBestSinceBlock = bsBlockRaw

  // 2. Block candidate — share >= network difficulty
  if (bsBlockRaw > 0 && netDiffRaw > 0 && bsBlockRaw >= netDiffRaw && !state.netDiffCrossedAlerted) {
    state.netDiffCrossedAlerted = true
    alerts.push(`block_candidate:${workerName}`)
    await sendDiscord(discord, blockCandidateEmbed(workerName, bestShareFmt, netDiffFmt, blockHeight))
  }
  if (bsBlockRaw < netDiffRaw * 0.1) {
    state.netDiffCrossedAlerted = false
  }

  // 3. Milestones
  for (const m of MILESTONES) {
    if (progressPercent >= m && !state.milestoneAlerted.includes(m)) {
      state.milestoneAlerted.push(m)
      alerts.push(`milestone:${m}%`)
      await sendDiscord(discord, milestoneEmbed(m, etaDays, etaHours, blockHeight))
    }
    if (progressPercent < m - 5) {
      state.milestoneAlerted = state.milestoneAlerted.filter((x) => x !== m)
    }
  }

  // Reset block height (new block detected)
  if (blockHeight > state.prevBlockHeight && state.prevBlockHeight > 0) {
    state.netDiffCrossedAlerted = false
    state.milestoneAlerted      = []
    state.prevBestSinceBlock    = 0
  }
  state.prevBlockHeight = blockHeight

  saveState(state)
  return NextResponse.json({ ok: true, alerts, progressPercent: progressPercent.toFixed(2) })
}
