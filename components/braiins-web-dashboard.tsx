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
      const res = await fetch(`https://solo.braiins.com/users/${address}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const stats: BraiinsStats = {
        hashrate1m: data.hashrate1m || 'N/A',
        hashrate5m: data.hashrate5m || 'N/A',
        hashrate1hr: data.hashrate1hr || 'N/A',
        bestshare: data.bestshare?.toFixed(0) || 'N/A',
        bestever: data.bestever?.toString() || 'N/A',
        totalshares: (data.shares / 1e9)?.toFixed(2) || 'N/A',
        workersOnline: data.workers || 0,
      }

      if (data.bestshare && data.bestshare.toString() !== prevBestShare.current && prevBestShare.current !== '') {
        await createAlert('best_share', `New best share: ${data.bestshare.toFixed(0)}`)
      }
      prevBestShare.current = data.bestshare?.toString() || ''

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
    if (!discordWebhook) return
    try {
      const embed = {
        embeds: [{
          title: type === 'best_share' ? '[BRAIINS] New Best Share!' : '[BRAIINS] Worker Offline',
          description: message,
          color: type === 'best_share' ? 0x00D9FF : 0xFF1493,
          timestamp: new Date().toISOString(),
        }]
      }
      await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed),
      })
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
      sent: false,
    }
    setAlerts((prev) => [alert, ...prev.slice(0, 9)])
    await sendDiscordAlert(message, type)
    try {
      await fetch('/api/alerts-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message }),
      })
    } catch (e) {
      console.log('[v0] Failed to save alert:', e)
    }
  }

  useEffect(() => {
    fetchBraiinsStats()
    const interval = setInterval(fetchBraiinsStats, 15000)
    return () => clearInterval(interval)
  }, [address])

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const res = await fetch('/api/alerts-web')
        if (res.ok) setAlerts(await res.json())
      } catch (e) {
        console.log('[v0] Failed to load alerts:', e)
      }
    }
    loadAlerts()
  }, [])

  if (!address) {
    return <div className="text-center text-red-400 font-mono p-4">ERROR: No address configured</div>
  }

  return (
    <div className="min-h-screen w-full bg-black overflow-hidden" style={{
      backgroundImage: 'linear-gradient(45deg, rgba(0,100,255,0.03) 1px, transparent 1px), linear-gradient(-45deg, rgba(100,0,255,0.03) 1px, transparent 1px)',
      backgroundSize: '60px 60px'
    }}>
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="border-b border-blue-500/20 bg-black/50 backdrop-blur-xl px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light tracking-wider text-blue-300">BRAIINS SOLO</h1>
              <p className="mt-1 text-xs text-blue-400/60 font-mono">Mining Telemetry • {address.slice(0, 12)}...</p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-2">
                <div className={`h-2 w-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                <span className="text-sm font-mono text-blue-300">{loading ? 'SYNCING' : 'LIVE'}</span>
              </div>
              {lastUpdate && <p className="text-xs text-blue-400/50 font-mono">{lastUpdate.toLocaleTimeString()}</p>}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col px-8 py-6 overflow-hidden">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/20 p-4 backdrop-blur text-red-400 text-sm font-mono">
              ⚠ {error}
            </div>
          )}

          {braiinsData && (
            <div className="flex flex-col gap-6 h-full overflow-hidden">
              {/* Key Metrics - 4 Column Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="group relative rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-black to-blue-900/5 p-4 backdrop-blur hover:border-blue-500/60 transition overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                  <div className="relative">
                    <p className="text-xs font-mono text-blue-400/70 tracking-wider">BEST SHARE</p>
                    <p className="mt-2 text-2xl font-light text-blue-300">{formatNumber(braiinsData.bestshare)}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-blue-600 to-transparent"></div>
                </div>

                <div className="group relative rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-black to-purple-900/5 p-4 backdrop-blur hover:border-purple-500/60 transition overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                  <div className="relative">
                    <p className="text-xs font-mono text-purple-400/70 tracking-wider">1M HASHRATE</p>
                    <p className="mt-2 text-2xl font-light text-purple-300">{formatNumber(braiinsData.hashrate1m)}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-purple-600 to-transparent"></div>
                </div>

                <div className="group relative rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-black to-cyan-900/5 p-4 backdrop-blur hover:border-cyan-500/60 transition overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                  <div className="relative">
                    <p className="text-xs font-mono text-cyan-400/70 tracking-wider">TOTAL SHARES</p>
                    <p className="mt-2 text-2xl font-light text-cyan-300">{formatNumber(braiinsData.totalshares)}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-cyan-600 to-transparent"></div>
                </div>

                <div className="group relative rounded-lg border border-pink-500/30 bg-gradient-to-br from-pink-950/20 via-black to-pink-900/5 p-4 backdrop-blur hover:border-pink-500/60 transition overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-600/5 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                  <div className="relative">
                    <p className="text-xs font-mono text-pink-400/70 tracking-wider">ACTIVE MINERS</p>
                    <p className="mt-2 text-2xl font-light text-pink-300">{miners.filter(m => m.lastshare && (Date.now() - m.lastshare * 1000) < 300000).length}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 via-pink-600 to-transparent"></div>
                </div>
              </div>

              {/* Active Miners - Main Section */}
              {(() => {
                const activeMinersList = miners.filter(miner => {
                  const isActive = miner.lastshare && (Date.now() - miner.lastshare * 1000) < 300000
                  return isActive
                })
                return activeMinersList.length > 0 && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <h2 className="text-lg font-light tracking-wider text-blue-300 mb-4">ACTIVE MINING RIGS ({activeMinersList.length})</h2>
                  <div className="grid grid-cols-3 gap-4 overflow-y-auto pb-2">
                    {activeMinersList.map((miner, idx) => {
                      const isActive = miner.lastshare && (Date.now() - miner.lastshare * 1000) < 300000
                      return (
                        <div key={idx} className="group relative rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-950/30 via-black to-blue-900/10 p-5 backdrop-blur hover:border-blue-500/70 transition overflow-hidden flex flex-col">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                          <div className="relative flex-1">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-mono text-lg font-semibold text-blue-300">{miner.name}</h3>
                              <div className={`h-3 w-3 rounded-full ${isActive ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-yellow-500'}`}></div>
                            </div>

                            <div className="space-y-3">
                              <div className="rounded-lg border border-blue-500/20 bg-blue-950/40 p-3">
                                <p className="text-xs text-blue-400/70 font-mono mb-1">1M HASHRATE</p>
                                <p className="text-xl font-light text-blue-300 font-mono">{formatNumber(miner.hashrate1m)}H/s</p>
                              </div>

                              <div className="rounded-lg border border-purple-500/20 bg-purple-950/40 p-3">
                                <p className="text-xs text-purple-400/70 font-mono mb-1">5M HASHRATE</p>
                                <p className="text-xl font-light text-purple-300 font-mono">{formatNumber(miner.hashrate5m)}H/s</p>
                              </div>

                              <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/40 p-3">
                                <p className="text-xs text-cyan-400/70 font-mono mb-1">BEST SHARE</p>
                                <p className="text-xl font-light text-cyan-300 font-mono">{formatNumber(miner.bestshare)}</p>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-xs">
                              <span className={`font-mono font-semibold ${isActive ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                {isActive ? '● ACTIVE' : '○ IDLE'}
                              </span>
                              <span className="text-blue-400/60 font-mono">{miner.shares} shares</span>
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-transparent"></div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                )
              })()}

              {/* Bottom Panels */}
              <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                <div className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-black to-blue-900/5 p-4 backdrop-blur">
                  <h3 className="text-sm font-mono text-blue-300 mb-3 tracking-wider">HASHRATE HISTORY</h3>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between p-2 rounded border border-blue-500/20 bg-blue-950/20">
                      <span className="text-blue-400/70">5M</span>
                      <span className="text-blue-300 font-light">{formatNumber(braiinsData.hashrate5m)}H/s</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border border-purple-500/20 bg-purple-950/20">
                      <span className="text-purple-400/70">1H</span>
                      <span className="text-purple-300 font-light">{formatNumber(braiinsData.hashrate1hr)}H/s</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border border-cyan-500/20 bg-cyan-950/20">
                      <span className="text-cyan-400/70">BEST EVER</span>
                      <span className="text-cyan-300 font-light">{formatNumber(braiinsData.bestever)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-pink-500/30 bg-gradient-to-br from-pink-950/20 via-black to-pink-900/5 p-4 backdrop-blur">
                  <h3 className="text-sm font-mono text-pink-300 mb-3 tracking-wider">RECENT ALERTS</h3>
                  {alerts.length === 0 ? (
                    <p className="text-xs text-pink-400/50 font-mono">No alerts • System optimal</p>
                  ) : (
                    <div className="space-y-2 max-h-24 overflow-y-auto text-xs font-mono">
                      {alerts.slice(0, 3).map((alert) => (
                        <div key={alert.id} className="rounded border border-pink-500/20 bg-pink-950/20 p-2">
                          <p className={`font-semibold ${alert.type === 'best_share' ? 'text-emerald-400' : 'text-red-400'}`}>
                            [{alert.type === 'best_share' ? '✓' : '!'}] {alert.message}
                          </p>
                          <p className="text-pink-400/40 text-xs mt-1">{new Date(alert.createdAt).toLocaleTimeString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 150, 255, 0.2);
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 150, 255, 0.4);
        }
      `}</style>
    </div>
  )
}
