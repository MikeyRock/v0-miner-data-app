import { NextResponse } from 'next/server'

const AXEBCH_API_URL = process.env.AXEBCH_API_URL || 'http://192.168.0.117:21212/api/node'

function formatHashrate(raw: number): { value: number; unit: string } {
  if (raw >= 1e12) return { value: parseFloat((raw / 1e12).toFixed(2)), unit: 'TH/s' }
  if (raw >= 1e9) return { value: parseFloat((raw / 1e9).toFixed(2)), unit: 'GH/s' }
  if (raw >= 1e6) return { value: parseFloat((raw / 1e6).toFixed(2)), unit: 'MH/s' }
  if (raw >= 1e3) return { value: parseFloat((raw / 1e3).toFixed(2)), unit: 'KH/s' }
  return { value: raw, unit: 'H/s' }
}

function formatDiff(raw: number): { value: number; unit: string } {
  if (raw >= 1e12) return { value: parseFloat((raw / 1e12).toFixed(2)), unit: 'T' }
  if (raw >= 1e9) return { value: parseFloat((raw / 1e9).toFixed(2)), unit: 'G' }
  if (raw >= 1e6) return { value: parseFloat((raw / 1e6).toFixed(2)), unit: 'M' }
  if (raw >= 1e3) return { value: parseFloat((raw / 1e3).toFixed(2)), unit: 'K' }
  return { value: raw, unit: '' }
}

export async function GET() {
  try {
    const res = await fetch(AXEBCH_API_URL, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned ${res.status}` }, { status: 502 })
    }

    const raw = await res.json()

    // Normalise the AxeBCH API response shape
    // The API returns: { blockHeight, difficulty, networkHashrate, workers: [...], ... }
    const blockDiffRaw: number = raw.difficulty ?? raw.blockDiff ?? 0
    const blockDiff = formatDiff(blockDiffRaw)

    const networkHashRaw: number = raw.networkHashrate ?? 0
    const networkHash = formatHashrate(networkHashRaw)

    const poolHashRaw: number = raw.hashrate ?? raw.poolHashrate ?? 0
    const poolHash = formatHashrate(poolHashRaw)

    const bestShareRaw: number = raw.bestShare ?? raw.bestDiff ?? 0
    const bestShare = formatDiff(bestShareRaw)

    // Progress to block = bestShare / blockDiff * 100
    const progressPercent = blockDiffRaw > 0
      ? Math.min(100, parseFloat(((bestShareRaw / blockDiffRaw) * 100).toFixed(2)))
      : 0

    // ETA based on pool hashrate vs difficulty
    const etaSeconds = poolHashRaw > 0 ? blockDiffRaw / poolHashRaw : 0
    const etaDays = Math.floor(etaSeconds / 86400)
    const etaHours = Math.floor((etaSeconds % 86400) / 3600)

    // Normalise workers array
    const rawWorkers: Record<string, unknown>[] = Array.isArray(raw.workers)
      ? raw.workers
      : Object.entries(raw.workers ?? {}).map(([id, w]) => ({ workerId: id, ...(w as object) }))

    const workers = rawWorkers.map((w) => {
      const workerHashRaw = (w.hashrate as number) ?? 0
      const workerHash = formatHashrate(workerHashRaw)
      const workerBestRaw = (w.bestShare as number) ?? (w.bestDiff as number) ?? 0
      const workerBest = formatDiff(workerBestRaw)
      const lastShareAgo = (w.lastShareTime as number) ?? (w.lastShare as number) ?? 0
      return {
        workerId: (w.workerId as string) ?? (w.name as string) ?? 'unknown',
        hashrate: workerHash.value,
        hashrateUnit: workerHash.unit,
        bestShare: workerBest.value,
        bestShareUnit: workerBest.unit,
        bestShareRaw: workerBestRaw,
        sharesAccepted: (w.sharesAccepted as number) ?? (w.accepted as number) ?? 0,
        sharesRejected: (w.sharesRejected as number) ?? (w.rejected as number) ?? 0,
        lastShareAgo,
        isOnline: lastShareAgo < 300,
      }
    })

    // Global ATH = max bestShare across all workers
    const athWorker = workers.reduce(
      (best, w) => (w.bestShareRaw > best.bestShareRaw ? w : best),
      workers[0] ?? { bestShareRaw: 0, workerId: '' }
    )
    const athRaw = athWorker?.bestShareRaw ?? 0
    const athFmt = formatDiff(athRaw)

    return NextResponse.json({
      height: raw.blockHeight ?? raw.height ?? 0,
      blockDiff: blockDiff.value,
      blockDiffUnit: blockDiff.unit,
      blockDiffRaw,
      networkHashrate: networkHash.value,
      networkHashrateUnit: networkHash.unit,
      progressPercent,
      etaDays,
      etaHours,
      poolHashrate: poolHash.value,
      poolHashrateUnit: poolHash.unit,
      bestShare: bestShare.value,
      bestShareUnit: bestShare.unit,
      bestShareRaw,
      workers,
      athShare: athFmt.value,
      athShareUnit: athFmt.unit,
      athShareWorker: athWorker?.workerId ?? '',
      timestamp: Date.now(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
