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
    return <div className="text-center text-red-400 font-mono">ERROR: No address configured</div>
  }

  return (
    <div className="w-full h-screen bg-black flex flex-col overflow-hidden">
      {/* Grid Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(0deg, rgba(0,217,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-magenta-500 font-mono">
              ⚡ BRAIINS SOLO
            </h1>
            <p className="text-xs text-cyan-400/50 font-mono mt-1">{address.slice(0, 16)}...</p>
          </div>
          <div className="text-right">
            <p className={`text-xs font-mono font-bold ${loading ? 'text-yellow-400' : 'text-lime-400'}`}>
              [{loading ? '●●●' : '●'}] {loading ? 'SYNC' : 'LIVE'}
            </p>
            {lastUpdate && <p className="text-xs text-cyan-400/50 font-mono">{lastUpdate.toLocaleTimeString()}</p>}
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="flex-1 overflow-hidden px-6 py-4">
          {error ? (
            <div className="rounded border border-red-500/50 bg-red-950/30 p-4 text-red-400 font-mono text-sm">⚠ ERROR: {error}</div>
          ) : braiinsData ? (
            <div className="grid grid-cols-4 grid-rows-2 gap-3 h-full">
              {/* Row 1: Main Stats */}
              <div className="rounded border border-cyan-500/40 bg-black/60 p-3 backdrop-blur flex flex-col justify-center">
                <p className="text-xs text-cyan-400/60 font-mono">BEST_SHARE</p>
                <p className="text-2xl font-bold text-cyan-400 font-mono">{formatNumber(braiinsData.bestshare)}</p>
              </div>

              <div className="rounded border border-magenta-500/40 bg-black/60 p-3 backdrop-blur flex flex-col justify-center">
                <p className="text-xs text-magenta-400/60 font-mono">1M_HASH</p>
                <p className="text-2xl font-bold text-magenta-400 font-mono">{formatNumber(braiinsData.hashrate1m)}</p>
              </div>

              <div className="rounded border border-purple-500/40 bg-black/60 p-3 backdrop-blur flex flex-col justify-center">
                <p className="text-xs text-purple-400/60 font-mono">TOTAL_SH</p>
                <p className="text-2xl font-bold text-purple-400 font-mono">{formatNumber(braiinsData.totalshares)}</p>
              </div>

              <div className="rounded border border-blue-500/40 bg-black/60 p-3 backdrop-blur flex flex-col justify-center">
                <p className="text-xs text-blue-400/60 font-mono">BEST_EVR</p>
                <p className="text-2xl font-bold text-blue-400 font-mono">{formatNumber(braiinsData.bestever)}</p>
              </div>

              {/* Row 2: Details + Miners */}
              <div className="col-span-2 rounded border border-cyan-500/30 bg-black/60 p-3 backdrop-blur overflow-hidden">
                <p className="text-xs text-cyan-400/60 font-mono mb-2">HASHRATE_HIST</p>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-cyan-300"><span>5M:</span><span>{formatNumber(braiinsData.hashrate5m)}</span></div>
                  <div className="flex justify-between text-magenta-300"><span>1H:</span><span>{formatNumber(braiinsData.hashrate1hr)}</span></div>
                </div>
              </div>

              <div className="col-span-2 rounded border border-magenta-500/30 bg-black/60 p-3 backdrop-blur overflow-hidden">
                <p className="text-xs text-magenta-400/60 font-mono mb-2">ALERTS ({alerts.length})</p>
                <div className="space-y-1 text-xs max-h-16 overflow-hidden">
                  {alerts.slice(0, 3).map((a) => (
                    <div key={a.id} className="text-cyan-300 font-mono truncate">
                      <span className={a.type === 'best_share' ? 'text-lime-400' : 'text-red-400'}>[{a.type === 'best_share' ? '✓' : '!'}]</span> {a.message.slice(0, 30)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-cyan-400/50 font-mono">Loading...</div>
          )}
        </div>

        {/* Miners Bar - Bottom */}
        {miners.length > 0 && (
          <div className="border-t border-magenta-500/30 px-6 py-3 overflow-x-auto">
            <p className="text-xs text-magenta-400/60 font-mono mb-2">ACTIVE_MINERS ({miners.length})</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {miners.map((m, i) => (
                <div key={i} className="rounded border border-magenta-500/40 bg-black/60 p-2 backdrop-blur flex-shrink-0 min-w-max text-xs font-mono">
                  <p className="text-magenta-300 font-bold">{m.name}</p>
                  <p className="text-cyan-400">1M: {formatNumber(m.hashrate1m)}</p>
                  <p className="text-blue-400">B: {formatNumber(m.bestshare)}</p>
                  <p className={m.lastshare && (Date.now() - m.lastshare * 1000) < 300000 ? 'text-lime-400' : 'text-yellow-400'}>
                    {m.lastshare && (Date.now() - m.lastshare * 1000) < 300000 ? 'ONLINE' : 'IDLE'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hide scrollbars */}
      <style>{`
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
      `}</style>
    </div>
  )
}
