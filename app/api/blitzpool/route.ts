import { NextRequest, NextResponse } from 'next/server'

const BLITZPOOL_API_BASE = 'https://blitzpool.yourdevice.ch:3334/api'

export interface BlitzpoolWorker {
  sessionId: string
  name: string
  bestDifficulty: string
  hashRate: number
  currentDifficulty: number
  startTime: string
  lastSeen: string
}

export interface BlitzpoolStats {
  bestDifficulty: number
  workersCount: number
  totalShares: number
  totalHashrate: number
  workers: BlitzpoolWorker[]
  networkDifficulty: number
  networkHashrate: number
  blockHeight: number
  progressPercent: number
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 })
  }

  try {
    const [clientRes, networkRes] = await Promise.all([
      fetch(`${BLITZPOOL_API_BASE}/client/${address}`, { cache: 'no-store' }),
      fetch(`${BLITZPOOL_API_BASE}/network`, { cache: 'no-store' }),
    ])

    if (!clientRes.ok) {
      return NextResponse.json({ error: `Blitzpool client API returned ${clientRes.status}` }, { status: clientRes.status })
    }

    const client = await clientRes.json()
    const network = networkRes.ok ? await networkRes.json() : null

    const networkDiff = network?.difficulty ?? 0
    const progressPercent = networkDiff > 0 ? (client.bestDifficulty / networkDiff) * 100 : 0

    const stats: BlitzpoolStats = {
      bestDifficulty: client.bestDifficulty ?? 0,
      workersCount: client.workersCount ?? 0,
      totalShares: client.totalShares ?? 0,
      totalHashrate: client.totalHashrate ?? 0,
      workers: (client.workers ?? []).map((w: BlitzpoolWorker) => ({
        sessionId: w.sessionId,
        name: w.name,
        bestDifficulty: w.bestDifficulty,
        hashRate: w.hashRate,
        currentDifficulty: w.currentDifficulty,
        startTime: w.startTime,
        lastSeen: w.lastSeen,
      })),
      networkDifficulty: networkDiff,
      networkHashrate: network?.networkhashps ?? 0,
      blockHeight: network?.blocks ?? 0,
      progressPercent,
    }

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'no-store', Connection: 'close' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch Blitzpool data' },
      { status: 502 }
    )
  }
}
