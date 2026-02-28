import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { HashrateWindow, NodeStats, WorkerStats } from '@/lib/types'

const DEFAULT_URL = process.env.AXEBCH_API_URL ?? ''

// ---- Formatters -------------------------------------------------------

function fmtHashrate(raw: number): { value: number; unit: string } {
  if (raw >= 1e15) return { value: +( raw / 1e15).toFixed(2), unit: 'PH/s' }
  if (raw >= 1e12) return { value: +( raw / 1e12).toFixed(2), unit: 'TH/s' }
  if (raw >= 1e9)  return { value: +( raw / 1e9 ).toFixed(2), unit: 'GH/s' }
  if (raw >= 1e6)  return { value: +( raw / 1e6 ).toFixed(2), unit: 'MH/s' }
  return { value: raw, unit: 'H/s' }
}

function fmtDiff(raw: number): { value: number; unit: string } {
  if (raw >= 1e12) return { value: +( raw / 1e12).toFixed(2), unit: 'T' }
  if (raw >= 1e9)  return { value: +( raw / 1e9 ).toFixed(2), unit: 'G' }
  if (raw >= 1e6)  return { value: +( raw / 1e6 ).toFixed(2), unit: 'M' }
  if (raw >= 1e3)  return { value: +( raw / 1e3 ).toFixed(1), unit: 'K' }
  return { value: raw, unit: '' }
}

function fmtHrWindow(label: string, raw: number): HashrateWindow {
  const f = fmtHashrate(raw)
  return { label, value: f.value, unit: f.unit }
}

// ---- Route ------------------------------------------------------------

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || DEFAULT_URL

  if (!url) {
    return NextResponse.json(
      { error: 'No API URL configured. Enter it in Settings.' },
      { status: 503 }
    )
  }

  let raw: Record<string, unknown>
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status} ${res.statusText}` },
        { status: 502 }
      )
    }
    raw = await res.json()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Could not reach ${url}: ${msg}` }, { status: 502 })
  }

  // ---- Pool-level fields (WillItMod /api/pool field names) -------------

  const workerCount: number = typeof raw.workers === 'number' ? (raw.workers as number) : 0

  const lastShareAgo: number = typeof raw.lastupdate === 'number'
    ? Math.max(0, Math.floor(Date.now() / 1000) - (raw.lastupdate as number))
    : 0

  // hashrate_ths is in TH/s — convert to H/s for formatter
  const poolHashRaw: number = typeof raw.hashrate_ths === 'number'
    ? (raw.hashrate_ths as number) * 1e12
    : 0
  const poolHash = fmtHashrate(poolHashRaw)

  // hashrates_ths: { "1m": 4410, "5m": 4670, ... }
  const windows: HashrateWindow[] = []
  const wMap = (raw.hashrates_ths ?? {}) as Record<string, number>
  const wKeys: [string, string][] = [
    ['1m','1m'],['5m','5m'],['15m','15m'],['1h','1h'],['6h','6h'],['1d','24h'],['7d','7d'],
  ]
  for (const [key, label] of wKeys) {
    if (typeof wMap[key] === 'number') {
      windows.push(fmtHrWindow(label, wMap[key] * 1e12))
    }
  }
  if (windows.length === 0 && poolHashRaw > 0) {
    windows.push(fmtHrWindow('now', poolHashRaw))
  }

  // Network difficulty
  const netDiffRaw: number = (raw.network_difficulty as number) ?? 0
  const netDiff = fmtDiff(netDiffRaw)

  const blockHeight: number = (raw.network_height as number) ?? 0

  const algo: string = typeof raw.network_algo === 'string'
    ? (raw.network_algo as string).toUpperCase()
    : 'SHA256D'

  // Best share since last block reset
  const bsBlockRaw: number = (raw.best_share_since_block as number) ?? 0
  const bsBlock = fmtDiff(bsBlockRaw)
  const bsBlockWorker: string = (raw.best_share_since_block_worker as string) ?? ''

  // All-time best share
  const bsAllTimeRaw: number = (raw.best_share_all_time as number) ?? bsBlockRaw
  const bsAllTime = fmtDiff(bsAllTimeRaw)
  const bsAllTimeWorker: string = ''

  // ETA — already provided in seconds
  const etaSeconds: number = (raw.eta_seconds as number) ?? 0
  const etaDays  = Math.floor(etaSeconds / 86400)
  const etaHours = Math.floor((etaSeconds % 86400) / 3600)

  // Progress = best share since block / network diff (capped at 100%)
  const progressPercent = netDiffRaw > 0
    ? Math.min(100, +((bsBlockRaw / netDiffRaw) * 100).toFixed(2))
    : 0

  // ---- Workers ---------------------------------------------------------
  // /api/pool returns worker count only, no per-worker breakdown
  const workers: WorkerStats[] = []

  const result: NodeStats = {
    workerCount,
    lastShareAgo,
    currentHashrate: poolHash.value,
    currentHashrateUnit: poolHash.unit,
    hashrateWindows: windows,
    networkDifficulty: netDiff.value,
    networkDifficultyUnit: netDiff.unit,
    networkDifficultyRaw: netDiffRaw,
    blockHeight,
    algo,
    bestShareSinceBlock: bsBlock.value,
    bestShareSinceBlockUnit: bsBlock.unit,
    bestShareSinceBlockWorker: bsBlockWorker,
    allTimeBest: bsAllTime.value,
    allTimeBestUnit: bsAllTime.unit,
    allTimeBestWorker: bsAllTimeWorker,
    progressPercent,
    etaDays,
    etaHours,
    workers,
    timestamp: Date.now(),
  }

  return NextResponse.json(result)
}
