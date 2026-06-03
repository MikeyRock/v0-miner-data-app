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

// Format numbers with K, M, G, T suffixes
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

  // Fetch Braiins stats from JSON API
  const fetchBraiinsStats = async () => {
    if (!address) {
      setError('No BTC address configured (NEXT_PUBLIC_BRAIINS_ADDRESS)')
      setLoading(false)
      return
    }

    try {
      console.log('[v0] Fetching Braiins stats for:', address)
      const res = await fetch(`https://solo.braiins.com/users/${address}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      console.log('[v0] Braiins API response:', data)

      const stats: BraiinsStats = {
        hashrate1m: data.hashrate1m || 'N/A',
        hashrate5m: data.hashrate5m || 'N/A',
        hashrate1hr: data.hashrate1hr || 'N/A',
        bestshare: data.bestshare?.toFixed(0) || 'N/A',
        bestever: data.bestever?.toString() || 'N/A',
        totalshares: (data.shares / 1e9)?.toFixed(2) || 'N/A',
        workersOnline: data.workers || 0,
      }

      // Check for new best share
      if (data.bestshare && data.bestshare.toString() !== prevBestShare.current && prevBestShare.current !== '') {
        const message = `New best share: ${data.bestshare.toFixed(0)}`
        await createAlert('best_share', message)
      }
      prevBestShare.current = data.bestshare?.toString() || ''

      setBraiinsData(stats)

      // Parse miners data
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
      console.log('[v0] Fetch error:', e)
      setError(e instanceof Error ? e.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }

  // Send alert to Discord
  const sendDiscordAlert = async (message: string, type: 'best_share' | 'worker_offline') => {
    if (!discordWebhook) {
      console.log('[v0] No Discord webhook configured')
      return
    }

    try {
      const embed = {
        embeds: [
          {
            title: type === 'best_share' ? '[Braiins Solo] New Best Share!' : '[Braiins Solo] Worker Offline',
            description: message,
            color: type === 'best_share' ? 0x3B82F6 : 0xEF4444,
            footer: { text: 'Braiins Solo Mining' },
            timestamp: new Date().toISOString(),
          },
        ],
      }

      const res = await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed),
      })

      if (!res.ok) {
        console.log('[v0] Discord alert failed:', res.status)
        return false
      }

      console.log('[v0] Discord alert sent')
      return true
    } catch (e) {
      console.log('[v0] Discord error:', e)
      return false
    }
  }

  // Create an alert in the log
  const createAlert = async (type: 'best_share' | 'worker_offline', message: string) => {
    const alert: Alert = {
      id: Date.now().toString(),
      type,
      message,
      createdAt: new Date().toISOString(),
      sent: false,
    }

    // Send to Discord
    const sent = await sendDiscordAlert(message, type)
    alert.sent = sent

    // Add to local state
    setAlerts((prev) => [alert, ...prev.slice(0, 49)])

    // Save to database
    try {
      await fetch('/api/alerts-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message }),
      })
    } catch (e) {
      console.log('[v0] Failed to save alert to DB:', e)
    }
  }

  // Poll Braiins stats every 15 seconds
  useEffect(() => {
    fetchBraiinsStats()

    const interval = setInterval(() => {
      fetchBraiinsStats()
    }, 15000)

    return () => clearInterval(interval)
  }, [address])

  // Load alert history on mount
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const res = await fetch('/api/alerts-web')
        if (res.ok) {
          const data = await res.json()
          setAlerts(data)
        }
      } catch (e) {
        console.log('[v0] Failed to load alerts:', e)
      }
    }

    loadAlerts()
  }, [])

  if (!address) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-semibold">Error: NEXT_PUBLIC_BRAIINS_ADDRESS not configured</p>
        <p className="text-sm text-red-600 mt-2">Add your BTC address to environment variables</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/30 pb-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-magenta-400">MINING TELEMETRY</h2>
          <p className="text-xs text-cyan-400/60 mt-1 font-mono">Wallet: {address.slice(0, 12)}...</p>
        </div>
        <div className="text-right">
          {lastUpdate && (
            <p className="text-xs text-cyan-400/60 font-mono">UPDATE: {lastUpdate.toLocaleTimeString()}</p>
          )}
          <p className={`text-sm font-mono font-bold ${loading ? 'text-yellow-400' : 'text-lime-400'}`}>
            [{loading ? '●●●' : '●'}] {loading ? 'SYNC...' : 'LIVE'}
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded border border-red-500/50 bg-red-950/30 p-4 backdrop-blur">
          <p className="text-sm text-red-400 font-mono font-bold">⚠ ERROR</p>
          <p className="text-xs text-red-300 mt-1 font-mono">{error}</p>
        </div>
      )}

      {braiinsData && (
        <>
          {/* Main Stats Grid - Cyberpunk Style */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {/* Best Share */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-magenta-500 rounded opacity-0 group-hover:opacity-30 blur transition"></div>
              <div className="relative rounded border border-cyan-500/50 bg-black/60 p-4 backdrop-blur hover:border-magenta-500/50 transition">
                <p className="text-xs font-mono text-cyan-400/70">BEST_SHARE</p>
                <p className="text-2xl font-bold font-mono text-cyan-400 mt-2">{formatNumber(braiinsData.bestshare)}</p>
                <div className="mt-1 h-1 w-full bg-gradient-to-r from-cyan-500 to-transparent rounded"></div>
              </div>
            </div>

            {/* 1m Hashrate */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-magenta-500 to-lime-500 rounded opacity-0 group-hover:opacity-30 blur transition"></div>
              <div className="relative rounded border border-magenta-500/50 bg-black/60 p-4 backdrop-blur hover:border-lime-500/50 transition">
                <p className="text-xs font-mono text-magenta-400/70">1M_HASHRATE</p>
                <p className="text-2xl font-bold font-mono text-magenta-400 mt-2">{formatNumber(braiinsData.hashrate1m)}H/s</p>
                <div className="mt-1 h-1 w-full bg-gradient-to-r from-magenta-500 to-transparent rounded"></div>
              </div>
            </div>

            {/* Total Shares */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-lime-500 to-cyan-500 rounded opacity-0 group-hover:opacity-30 blur transition"></div>
              <div className="relative rounded border border-lime-500/50 bg-black/60 p-4 backdrop-blur hover:border-cyan-500/50 transition">
                <p className="text-xs font-mono text-lime-400/70">TOTAL_SHARES</p>
                <p className="text-2xl font-bold font-mono text-lime-400 mt-2">{formatNumber(braiinsData.totalshares)}</p>
                <div className="mt-1 h-1 w-full bg-gradient-to-r from-lime-500 to-transparent rounded"></div>
              </div>
            </div>

            {/* Best Ever */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-red-500 rounded opacity-0 group-hover:opacity-30 blur transition"></div>
              <div className="relative rounded border border-yellow-500/50 bg-black/60 p-4 backdrop-blur hover:border-red-500/50 transition">
                <p className="text-xs font-mono text-yellow-400/70">BEST_EVER</p>
                <p className="text-2xl font-bold font-mono text-yellow-400 mt-2">{formatNumber(braiinsData.bestever)}</p>
                <div className="mt-1 h-1 w-full bg-gradient-to-r from-yellow-500 to-transparent rounded"></div>
              </div>
            </div>
          </div>

          {/* Hashrate History Panel */}
          <div className="rounded border border-cyan-500/30 bg-black/40 p-4 backdrop-blur">
            <h3 className="font-mono text-sm font-bold text-cyan-400 mb-4">HASHRATE_HISTORY</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-2 rounded border border-cyan-500/20 bg-cyan-500/5">
                <span className="font-mono text-cyan-400/70">5M:</span>
                <span className="font-mono text-cyan-300 font-bold">{formatNumber(braiinsData.hashrate5m)}H/s</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded border border-magenta-500/20 bg-magenta-500/5">
                <span className="font-mono text-magenta-400/70">1H:</span>
                <span className="font-mono text-magenta-300 font-bold">{formatNumber(braiinsData.hashrate1hr)}H/s</span>
              </div>
            </div>
          </div>

          {/* Active Miners Panel */}
          {miners.length > 0 && (
            <div className="rounded border border-magenta-500/30 bg-black/40 p-4 backdrop-blur">
              <h3 className="font-mono text-sm font-bold text-magenta-400 mb-4">ACTIVE_MINERS ({miners.length})</h3>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {miners.map((miner, idx) => (
                  <div key={idx} className="rounded border border-magenta-500/20 bg-magenta-500/5 p-3 hover:border-magenta-500/50 transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold text-magenta-300">{miner.name}</span>
                      <span className={`text-xs font-mono px-2 py-1 rounded ${
                        miner.lastshare && (Date.now() - miner.lastshare * 1000) < 300000
                          ? 'bg-lime-500/20 text-lime-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {miner.lastshare && (Date.now() - miner.lastshare * 1000) < 300000 ? 'ACTIVE' : 'IDLE'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded border border-magenta-500/10 bg-black/40 p-2">
                        <p className="text-magenta-400/60 font-mono text-xs">1M_RATE</p>
                        <p className="font-mono font-bold text-magenta-300">{formatNumber(miner.hashrate1m)}H/s</p>
                      </div>
                      <div className="rounded border border-cyan-500/10 bg-black/40 p-2">
                        <p className="text-cyan-400/60 font-mono text-xs">5M_RATE</p>
                        <p className="font-mono font-bold text-cyan-300">{formatNumber(miner.hashrate5m)}H/s</p>
                      </div>
                      <div className="rounded border border-lime-500/10 bg-black/40 p-2">
                        <p className="text-lime-400/60 font-mono text-xs">BEST_SHARE</p>
                        <p className="font-mono font-bold text-lime-300">{formatNumber(miner.bestshare)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Alert Log Panel */}
      <div className="rounded border border-lime-500/30 bg-black/40 p-4 backdrop-blur">
        <h3 className="font-mono text-sm font-bold text-lime-400 mb-4">ALERT_LOG</h3>
        {alerts.length === 0 ? (
          <p className="text-xs font-mono text-lime-400/50">// NO ALERTS - SYSTEM OPTIMAL</p>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded border border-lime-500/20 bg-lime-500/5 p-2 hover:border-lime-500/50 transition">
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${
                    alert.type === 'best_share' 
                      ? 'bg-cyan-500/20 text-cyan-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    [{alert.type === 'best_share' ? '✓' : '!'}]
                  </span>
                  <span className="text-xs font-mono text-lime-400/60">{alert.sent ? '◆' : '◇'}</span>
                </div>
                <p className="text-xs font-mono text-lime-300">{alert.message}</p>
                <p className="mt-1 text-xs font-mono text-lime-400/40">{alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString() : 'N/A'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
