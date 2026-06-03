'use client'

import { useEffect, useRef, useState } from 'react'

interface BraiinsStats {
  hashrate1m: string
  hashrate5m: string
  hashrate1hr: string
  bestshare: string
  bestever: string
  totalshares: string
  workersOnline: number
}

interface Miner {
  name: string
  hashrate1m: string
  hashrate5m: string
  bestshare: number
  lastshare: number
  shares: number
}

interface Alert {
  id: string
  type: 'best_share' | 'worker_offline'
  message: string
  createdAt: string
  sent?: boolean
}

// Format hashrate with TH/s, GH/s, MH/s units
function formatHashrate(value: string | number | undefined): string {
  if (!value) return '0 TH/s'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0 TH/s'
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)} TH/s`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)} GH/s`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)} MH/s`
  return `${num.toFixed(2)} KH/s`
}

// Format shares/difficulty with G, M, K units
function formatNumber(value: string | number | undefined): string {
  if (!value) return '0'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}G`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toFixed(2)
}

export function BraiinsWebDashboard() {
  const address = process.env.NEXT_PUBLIC_BRAIINS_ADDRESS || ''
  const discordWebhook = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || ''

  const [braiinsData, setBraiinsData] = useState<BraiinsStats | null>(null)
  const [miners, setMiners] = useState<Miner[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const prevBestShare = useRef<string>('')
  const seenOnlineWorkers = useRef<Set<string>>(new Set())
  const offlineAlerted = useRef<Set<string>>(new Set())

  const fetchBraiinsStats = async () => {
    if (!address) {
      setError('No BTC address configured')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`https://solo.braiins.com/users/${address}`, {
        cache: 'no-store',
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()

      const stats: BraiinsStats = {
        hashrate1m: data.hashrate1m || '0',
        hashrate5m: data.hashrate5m || '0',
        hashrate1hr: data.hashrate1hr || '0',
        bestshare: data.bestshare?.toString() || '0',
        bestever: data.bestever?.toString() || '0',
        totalshares: (data.shares / 1e9)?.toFixed(2) || '0',
        workersOnline: data.workers || 0,
      }

      // Check for new best share alert
      const currentBestShare = parseFloat(data.bestshare?.toString() || '0')
      const previousBestShare = parseFloat(prevBestShare.current || '0')
      
      if (currentBestShare > 0 && previousBestShare > 0 && currentBestShare > previousBestShare) {
        const message = `New Best Share: ${formatNumber(currentBestShare)}`
        await createAlert('best_share', message)
      }
      prevBestShare.current = currentBestShare.toString()

      setBraiinsData(stats)

      if (data.worker && Array.isArray(data.worker)) {
        const minersList: Miner[] = data.worker.map((w: any) => ({
          name: w.workername?.split('.').pop() || 'unknown',
          hashrate1m: w.hashrate1m || '0',
          hashrate5m: w.hashrate5m || '0',
          bestshare: w.bestshare || 0,
          lastshare: w.lastshare || 0,
          shares: w.shares || 0,
        }))
        setMiners(minersList)
      }

      setError(null)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  const sendDiscordAlert = async (message: string, type: 'best_share' | 'worker_offline') => {
    if (!discordWebhook) {
      return
    }
    try {
      const res = await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: type === 'best_share' ? '⚡ New Best Share!' : '⚠ Worker Offline',
            description: message,
            color: type === 'best_share' ? 3066993 : 15158332,
            footer: { text: 'Braiins Solo Mining' },
            timestamp: new Date().toISOString(),
          }],
        }),
      })
      if (!res.ok) console.log('[v0] Discord alert failed:', res.status)
    } catch (e) {
      console.log('[v0] Discord error:', e)
    }
  }

  const createAlert = async (type: 'best_share' | 'worker_offline', message: string) => {
    const alert: Alert = {
      id: Date.now().toString(),
      type,
      message,
      createdAt: new Date().toISOString(),
      sent: true,
    }
    setAlerts((prev) => [alert, ...prev.slice(0, 19)])
    await sendDiscordAlert(message, type)
  }

  useEffect(() => {
    fetchBraiinsStats()
    const interval = setInterval(fetchBraiinsStats, 15000)
    return () => clearInterval(interval)
  }, [address])

  if (!address) {
    return <div className="text-red-400 p-4 font-mono text-sm">Error: NEXT_PUBLIC_BRAIINS_ADDRESS not configured</div>
  }

  return (
    <div className="min-h-screen bg-black bg-[linear-gradient(45deg,_rgba(0,200,255,0.03)_1px,_transparent_1px),_linear-gradient(-45deg,_rgba(100,50,255,0.03)_1px,_transparent_1px)] bg-[length:60px_60px] p-3 flex flex-col gap-3">
      {/* Header & Key Metrics */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-cyan-500/20">
        <div className="flex-1">
          <h1 className="text-base font-light text-cyan-400 font-mono tracking-wide">BRAIINS SOLO</h1>
          <p className="text-xs text-cyan-500/50 font-mono">{address.slice(0, 12)}...</p>
        </div>
        <div className="text-right">
          <p className={`text-xs font-mono ${loading ? 'text-yellow-400' : 'text-lime-400'}`}>
            {loading ? 'SYNC' : 'LIVE'} {lastUpdate && `@ ${lastUpdate.toLocaleTimeString()}`}
          </p>
        </div>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-500/20 rounded p-2 font-mono">{error}</div>}

      {braiinsData && (
        <>
          {/* Key Stats - Compact 4-column */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded border border-cyan-500/30 bg-black/60 p-2 backdrop-blur hover:border-cyan-500/60 transition">
              <p className="text-xs font-mono text-cyan-400/60">BEST SHARE</p>
              <p className="text-sm font-bold text-cyan-300">{formatNumber(braiinsData.bestshare)}</p>
            </div>
            <div className="rounded border border-blue-500/30 bg-black/60 p-2 backdrop-blur hover:border-blue-500/60 transition">
              <p className="text-xs font-mono text-blue-400/60">1M RATE</p>
              <p className="text-sm font-bold text-blue-300">{formatHashrate(braiinsData.hashrate1m)}</p>
            </div>
            <div className="rounded border border-purple-500/30 bg-black/60 p-2 backdrop-blur hover:border-purple-500/60 transition">
              <p className="text-xs font-mono text-purple-400/60">TOTAL SHARES</p>
              <p className="text-sm font-bold text-purple-300">{formatNumber(braiinsData.totalshares)}G</p>
            </div>
            <div className="rounded border border-pink-500/30 bg-black/60 p-2 backdrop-blur hover:border-pink-500/60 transition">
              <p className="text-xs font-mono text-pink-400/60">ACTIVE</p>
              <p className="text-sm font-bold text-pink-300">{miners.filter(m => m.lastshare && (Date.now() - m.lastshare * 1000) < 300000).length}</p>
            </div>
          </div>

          {/* Active Miners - Compact Grid */}
          {(() => {
            const activeMinersList = miners.filter(m => m.lastshare && (Date.now() - m.lastshare * 1000) < 300000)
            return activeMinersList.length > 0 && (
              <div className="flex-1 flex flex-col min-h-0">
                <p className="text-xs font-mono text-cyan-300/70 mb-2">MINING RIGS ({activeMinersList.length})</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 overflow-y-auto">
                  {activeMinersList.map((miner, idx) => (
                    <div key={idx} className="rounded border border-cyan-500/20 bg-black/60 p-2 backdrop-blur hover:border-cyan-500/40 transition">
                      <p className="text-xs font-mono font-bold text-cyan-300 truncate">{miner.name}</p>
                      <div className="mt-1 space-y-0.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-cyan-500/60">1M:</span>
                          <span className="font-mono text-cyan-300">{formatHashrate(miner.hashrate1m)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-500/60">5M:</span>
                          <span className="font-mono text-blue-300">{formatHashrate(miner.hashrate5m)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-500/60">Best:</span>
                          <span className="font-mono text-purple-300">{formatNumber(miner.bestshare)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Bottom Row - History & Alerts */}
          <div className="grid grid-cols-2 gap-2 max-h-24">
            {/* Hashrate History */}
            <div className="rounded border border-blue-500/20 bg-black/60 p-2 backdrop-blur overflow-y-auto">
              <p className="text-xs font-mono text-blue-300/70 mb-1">HASHRATE HISTORY</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-blue-500/60">5M:</span>
                  <span className="font-mono text-blue-300">{formatHashrate(braiinsData.hashrate5m)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-500/60">1H:</span>
                  <span className="font-mono text-purple-300">{formatHashrate(braiinsData.hashrate1hr)}</span>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="rounded border border-pink-500/20 bg-black/60 p-2 backdrop-blur overflow-y-auto">
              <p className="text-xs font-mono text-pink-300/70 mb-1">ALERTS</p>
              {alerts.length === 0 ? (
                <p className="text-xs text-pink-500/50 font-mono">No alerts</p>
              ) : (
                <div className="space-y-0.5 text-xs">
                  {alerts.slice(0, 4).map((a) => (
                    <div key={a.id} className="text-pink-300 font-mono truncate">
                      <span className="text-pink-500/60">[{a.type === 'best_share' ? '✓' : '!'}]</span> {a.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
