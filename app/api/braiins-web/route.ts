import { NextRequest, NextResponse } from 'next/server'

interface BraiinsWorker {
  name: string
  hashrate: number
  lastshare: number
}

export interface BraiinsStats {
  bestDifficulty: number
  totalHashrate: string
  totalShares: number
  workersCount: number
  workers: BraiinsWorker[]
}

const BRAIINS_API_BASE = 'https://braiins.com/pool'

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')
    if (!address) {
      return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 })
    }

    console.log('[v0] Fetching Braiins for address:', address)
    
    const res = await fetch(`${BRAIINS_API_BASE}/api/accounts/${address}`, {
      cache: 'no-store',
    })

    console.log('[v0] Braiins API response status:', res.status)
    
    if (!res.ok) {
      const errorText = await res.text()
      console.log('[v0] Braiins API error:', errorText)
      return NextResponse.json({ error: `Braiins API error: ${res.status}`, details: errorText }, { status: res.status })
    }

    const data = await res.json()
    console.log('[v0] Braiins API data:', JSON.stringify(data).slice(0, 200))

    // Parse Braiins response
    const stats: BraiinsStats = {
      bestDifficulty: data.bestDifficulty || 0,
      totalHashrate: data.totalHashrate || '0',
      totalShares: data.totalShares || 0,
      workersCount: data.workersCount || 0,
      workers: (data.workers || []).map((w: any) => ({
        name: w.name || 'unknown',
        hashrate: w.hashrate || 0,
        lastshare: w.lastshare || 0,
      })),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[v0] Braiins API error:', error)
    return NextResponse.json({ error: 'Failed to fetch Braiins data' }, { status: 500 })
  }
}
