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

function getBaseUrl(url: string): string {
  // Strip /api/pool or /api/workers suffix to get base URL
  return url.replace(/\/api\/(pool|workers|node)\/?$/, '')
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || DEFAULT_URL

  if (!url) {
    return NextResponse.json(
      { error: 'No API URL configured. Enter it in Settings.' },
      { status: 503 }
    )
  }

  const base = getBaseUrl(url)
  const poolUrl    = `${base}/api/pool`
  const workersUrl = `${base}/api/workers`

  let raw: Record<string, unknown>
  let rawWorkerList: Record<string, unknown>[] = []

  try {
    const res = await fetch(poolUrl, {
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
    return NextResponse.json({ error: `Could not reach ${poolUrl}: ${msg}` }, { status: 502 })
  }

  // Fetch per-worker data — best effort, don't fail if unavailable
  try {
    const wRes = await fetch(workersUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (wRes.ok) {
      const wJson = await wRes.json()
      // WillItMod returns either an array or an object keyed by worker name
      if (Array.isArray(wJson)) {
        rawWorkerList = wJson as Record<string, unknown>[]
      } else if (typeof wJson === 'object' && wJson !== null) {
        rawWorkerList = Object.entries(wJson as Record<string, unknown>).map(([name, data]) => ({
          name,
          ...(typeof data === 'object' && data !== null ? data as object : {}),
        }))
      }
    }
  } catch {
    // Silently ignore — workers list is optional
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
  // Build worker list from /api/workers if available, fallback to count-only
  const workers: WorkerStats[] = rawWorkerList.map((w) => {
    const name = (w.name as string) ?? (w.workerId as string) ?? (w.worker as string) ?? 'unknown'
    const hrRaw = typeof w.hashrate_ths === 'number'
      ? (w.hashrate_ths as number) * 1e12
      : typeof w.hashrate === 'number' ? (w.hashrate as number) : 0
    const hr = fmtHashrate(hrRaw)
    const bsRaw = (w.best_share as number) ?? (w.bestShare as number) ?? (w.record as number) ?? 0
    const bs = fmtDiff(bsRaw)
    const lastUpdate = (w.lastupdate as number) ?? (w.last_share as number) ?? 0
    const lsa = lastUpdate > 0
      ? Math.max(0, Math.floor(Date.now() / 1000) - lastUpdate)
      : 0

    return {
      workerId: name,
      hashrate: hr.value,
      hashrateUnit: hr.unit,
      hashrateRaw: hrRaw,
      bestShare: bs.value,
      bestShareUnit: bs.unit,
      bestShareRaw: bsRaw,
      odds: (w.odds as string) ?? '',
      lastShareAgo: lsa,
      isOnline: lsa < 600,
    }
  })

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
    bestShareSinceBlockRaw: bsBlockRaw,
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
