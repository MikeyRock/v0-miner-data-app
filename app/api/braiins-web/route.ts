import { NextRequest, NextResponse } from 'next/server'

interface BraiinsWorker {
  workername: string
  hashrate1m: string
  hashrate5m: string
  lastshare: number
  shares: number
  bestshare: number
}

export interface BraiinsStats {
  totalHashrate1m: string
  totalHashrate5m: string
  totalHashrate1hr: string
  bestshare: number
  bestever: number
  totalShares: number
  workers: number
  workerList: Array<{
    name: string
    hashrate1m: string
    lastshare: number
    shares: number
    bestshare: number
  }>
}

const BRAIINS_API_BASE = 'https://solo.braiins.com'

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')
    if (!address) {
      return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 })
    }

    console.log('[v0] Fetching Braiins for address:', address)
    
    const res = await fetch(`${BRAIINS_API_BASE}/users/${address}`, {
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
      totalHashrate1m: data.hashrate1m || '0',
      totalHashrate5m: data.hashrate5m || '0',
      totalHashrate1hr: data.hashrate1hr || '0',
      bestshare: data.bestshare || 0,
      bestever: data.bestever || 0,
      totalShares: data.shares || 0,
      workers: data.workers || 0,
      workerList: (data.worker || []).map((w: any) => ({
        name: w.workername?.split('.').pop() || 'unknown',
        hashrate1m: w.hashrate1m || '0',
        lastshare: w.lastshare || 0,
        shares: w.shares || 0,
        bestshare: w.bestshare || 0,
      })),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[v0] Braiins API error:', error)
    return NextResponse.json({ error: 'Failed to fetch Braiins data' }, { status: 500 })
  }
}
