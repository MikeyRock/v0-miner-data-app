import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const DEFAULT_URL = 'http://192.168.0.117:21212/api/node'

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

function buildMockResponse() {
  const blockDiffRaw = 1.08e12 // 1.08T
  const bestShareRaw = 560.04e9 // 560.04G
  const progressPercent = parseFloat(((bestShareRaw / blockDiffRaw) * 100).toFixed(2))
  const blockDiff = formatDiff(blockDiffRaw)
  const bestShare = formatDiff(bestShareRaw)
  const poolHashRaw = 850e6 // 850 GH/s
  const poolHash = formatHashrate(poolHashRaw)
  const networkHashRaw = 2.4e18
  const networkHash = formatHashrate(networkHashRaw)
  const etaSeconds = blockDiffRaw / poolHashRaw
  const etaDays = Math.floor(etaSeconds / 86400)
  const etaHours = Math.floor((etaSeconds % 86400) / 3600)

  const workers = [
    {
      workerId: 'Smallerbirdy',
      hashrate: 450,
      hashrateUnit: 'GH/s',
      bestShare: 560.04,
      bestShareUnit: 'G',
      bestShareRaw: 560.04e9,
      sharesAccepted: 4821,
      sharesRejected: 3,
      lastShareAgo: 60,
      isOnline: true,
    },
    {
      workerId: 'NanoMiner1',
      hashrate: 400,
      hashrateUnit: 'GH/s',
      bestShare: 212.5,
      bestShareUnit: 'G',
      bestShareRaw: 212.5e9,
      sharesAccepted: 3215,
      sharesRejected: 1,
      lastShareAgo: 135,
      isOnline: true,
    },
    {
      workerId: 'BitAxe3',
      hashrate: 0,
      hashrateUnit: 'GH/s',
      bestShare: 98.2,
      bestShareUnit: 'G',
      bestShareRaw: 98.2e9,
      sharesAccepted: 842,
      sharesRejected: 12,
      lastShareAgo: 720,
      isOnline: false,
    },
  ]

  const athWorker = workers[0]
  const athFmt = formatDiff(athWorker.bestShareRaw)

  return {
    height: 939995,
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
    athShareWorker: athWorker.workerId,
    timestamp: Date.now(),
    isMock: true,
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') ?? process.env.AXEBCH_API_URL ?? DEFAULT_URL
  const forceMock = req.nextUrl.searchParams.get('mock') === '1'

  if (forceMock) {
    return NextResponse.json(buildMockResponse())
  }

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) {
      // Upstream reachable but returned an error — surface it clearly
      return NextResponse.json(
        { error: `Upstream ${url} returned ${res.status} ${res.statusText}` },
        { status: 502 }
      )
    }

    const raw = await res.json()

    const blockDiffRaw: number = raw.difficulty ?? raw.blockDiff ?? 0
    const blockDiff = formatDiff(blockDiffRaw)
    const networkHashRaw: number = raw.networkHashrate ?? 0
    const networkHash = formatHashrate(networkHashRaw)
    const poolHashRaw: number = raw.hashrate ?? raw.poolHashrate ?? 0
    const poolHash = formatHashrate(poolHashRaw)
    const bestShareRaw: number = raw.bestShare ?? raw.bestDiff ?? 0
    const bestShare = formatDiff(bestShareRaw)

    const progressPercent =
      blockDiffRaw > 0
        ? Math.min(100, parseFloat(((bestShareRaw / blockDiffRaw) * 100).toFixed(2)))
        : 0

    const etaSeconds = poolHashRaw > 0 ? blockDiffRaw / poolHashRaw : 0
    const etaDays = Math.floor(etaSeconds / 86400)
    const etaHours = Math.floor((etaSeconds % 86400) / 3600)

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
      isMock: false,
    })
  } catch (err) {
    // Can't reach upstream — return mock data so preview/UI still renders
    const message = err instanceof Error ? err.message : 'Unknown error'
    const mock = buildMockResponse()
    return NextResponse.json({
      ...mock,
      isMock: true,
      mockReason: `Could not reach ${url}: ${message}`,
    })
  }
}
