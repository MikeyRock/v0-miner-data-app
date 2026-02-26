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

  // ---- Pool-level fields -----------------------------------------------
  // AxeBCH exposes these at the top level — field names may vary by version.
  // We try multiple possible keys so it stays robust.

  const workerCount: number =
    (raw.connectedMiners as number) ??
    (raw.workerCount as number) ??
    ((raw.workers as unknown[])?.length ?? 0)

  const lastShareAgo: number =
    (raw.lastShareTime as number) ?? (raw.timeSinceLastShare as number) ?? 0

  // Current / best-effort hashrate
  const poolHashRaw: number =
    (raw.poolHashrate as number) ??
    (raw.hashrate as number) ??
    (raw.currentHashrate as number) ?? 0
  const poolHash = fmtHashrate(poolHashRaw)

  // Hashrate windows (AxeBCH typically exposes hashrateHistory or hashrate1m etc.)
  const windows: HashrateWindow[] = []
  const wKeys: [string, string][] = [
    ['hashrate1m', '1m'], ['hashrate5m', '5m'], ['hashrate15m', '15m'],
    ['hashrate1h', '1h'], ['hashrate6h', '6h'], ['hashrate1d', '24h'], ['hashrate7d', '7d'],
  ]
  for (const [key, label] of wKeys) {
    if (typeof raw[key] === 'number') {
      windows.push(fmtHrWindow(label, raw[key] as number))
    }
  }
  // Fallback: use current for "1m" window if nothing found
  if (windows.length === 0 && poolHashRaw > 0) {
    windows.push(fmtHrWindow('now', poolHashRaw))
  }

  // Network difficulty
  const netDiffRaw: number =
    (raw.networkDifficulty as number) ??
    (raw.difficulty as number) ??
    (raw.blockDiff as number) ?? 0
  const netDiff = fmtDiff(netDiffRaw)

  const blockHeight: number =
    (raw.blockHeight as number) ??
    (raw.height as number) ??
    (raw.chainHeight as number) ?? 0

  const algo: string = (raw.algo as string) ?? 'SHA256D'

  // Best share since last block reset
  const bsBlockRaw: number =
    (raw.bestShareSinceBlock as number) ??
    (raw.bestShare as number) ??
    (raw.bestDiff as number) ?? 0
  const bsBlock = fmtDiff(bsBlockRaw)
  const bsBlockWorker: string =
    (raw.bestShareSinceBlockWorker as string) ??
    (raw.bestShareWorker as string) ?? ''

  // All-time best share
  const bsAllTimeRaw: number =
    (raw.allTimeBest as number) ??
    (raw.allTimeBestShare as number) ??
    bsBlockRaw  // fall back to since-block if no separate ATH
  const bsAllTime = fmtDiff(bsAllTimeRaw)
  const bsAllTimeWorker: string =
    (raw.allTimeBestWorker as string) ??
    (raw.allTimeBestShareWorker as string) ?? ''

  // ETA
  const etaSeconds: number =
    (raw.estimatedTimeToBlock as number) ??
    (raw.eta as number) ??
    (poolHashRaw > 0 ? netDiffRaw / poolHashRaw : 0)
  const etaDays  = Math.floor(etaSeconds / 86400)
  const etaHours = Math.floor((etaSeconds % 86400) / 3600)

  // Progress = best share since block / network diff (capped at 100%)
  const progressPercent =
    netDiffRaw > 0
      ? Math.min(100, +( (bsBlockRaw / netDiffRaw) * 100 ).toFixed(2))
      : 0

  // ---- Workers ---------------------------------------------------------
  const rawWorkers: Record<string, unknown>[] = Array.isArray(raw.workers)
    ? (raw.workers as Record<string, unknown>[])
    : Object.entries((raw.workers as Record<string, unknown>) ?? {}).map(
        ([id, w]) => ({ workerId: id, ...(w as object) })
      )

  const workers: WorkerStats[] = rawWorkers.map((w) => {
    const hrRaw = (w.hashrate as number) ?? (w.currentHashrate as number) ?? 0
    const hr = fmtHashrate(hrRaw)
    const bsRaw = (w.bestShare as number) ?? (w.bestDiff as number) ?? (w.record as number) ?? 0
    const bs = fmtDiff(bsRaw)
    const lsa = (w.lastShareTime as number) ?? (w.lastShare as number) ?? 0
    const odds = (w.odds as string) ?? (w.oddsString as string) ?? ''

    return {
      workerId: (w.workerId as string) ?? (w.name as string) ?? (w.id as string) ?? 'unknown',
      hashrate: hr.value,
      hashrateUnit: hr.unit,
      hashrateRaw: hrRaw,
      bestShare: bs.value,
      bestShareUnit: bs.unit,
      bestShareRaw: bsRaw,
      odds,
      lastShareAgo: lsa,
      isOnline: lsa < 300,
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
