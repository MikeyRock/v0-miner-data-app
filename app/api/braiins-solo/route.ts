import { NextRequest, NextResponse } from 'next/server'

export interface BraiinsSoloStats {
  hashrate1m: string
  hashrate5m: string
  hashrate1hr: string
  hashrate1d: string
  hashrate7d: string
  lastshare: number
  workers: number
  shares: number
  rejected: number
  bestshare: number
  bestever: number
  worker: {
    workername: string
    hashrate1m: string
    hashrate5m: string
    hashrate1hr: string
    hashrate1d: string
    hashrate7d: string
    lastshare: number
    shares: number
    rejected: number
    bestshare: number
    bestever: number
    useragent: string
  }[]
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  
  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://solo.braiins.com/users/${address}`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Braiins API returned ${res.status}` }, { status: res.status })
    }

    const data: BraiinsSoloStats = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fetch failed' }, { status: 500 })
  }
}
