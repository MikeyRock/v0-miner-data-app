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

function formatHashrate(value: string | number | undefined): string {
  if (!value) return '0 TH/s'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0 TH/s'
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)} TH/s`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)} GH/s`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)} MH/s`
  return `${num.toFixed(2)} KH/s`
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

  const fetchBraiinsStats = async () => {
    if (!address) {
      setError('No BTC address configured')
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
    if (!discordWebhook) return
    try {
      await fetch(discordWebhook, {
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

  const activeMinersList = miners.filter(m => m.lastshare && (Date.now() - m.lastshare * 1000) < 300000)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
        <div>
          <h1 className="text-3xl font-bold">Braiins Solo</h1>
          <p className="text-slate-400 text-sm mt-1">Mining Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-cyan-400'}`}></div>
          <span className={`text-sm font-medium ${loading ? 'text-yellow-400' : 'text-cyan-400'}`}>
            {loading ? 'Updating...' : 'Live'}
          </span>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Best Share Card */}
          <div className="group relative rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 backdrop-blur">
            <div className="flex items-start justify-between mb-3">
              <div className="text-cyan-400 text-xs font-bold uppercase tracking-wider">Best Share</div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400">📊</div>
            </div>
            <div className="text-2xl font-bold text-white">{formatNumber(braiinsData?.bestshare)}</div>
            <div className="text-slate-400 text-xs mt-2">Peak difficulty reached</div>
            <div className="mt-3 h-1 bg-gradient-to-r from-cyan-500 to-transparent rounded-full"></div>
          </div>

          {/* 1M Hashrate Card */}
          <div className="group relative rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur">
            <div className="flex items-start justify-between mb-3">
              <div className="text-purple-400 text-xs font-bold uppercase tracking-wider">1m Hashrate</div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-purple-400">⚡</div>
            </div>
            <div className="text-2xl font-bold text-white">{formatHashrate(braiinsData?.hashrate1m)}</div>
            <div className="text-slate-400 text-xs mt-2">Current rate</div>
            <div className="mt-3 h-1 bg-gradient-to-r from-purple-500 to-transparent rounded-full"></div>
          </div>

          {/* Total Shares Card */}
          <div className="group relative rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 backdrop-blur">
            <div className="flex items-start justify-between mb-3">
              <div className="text-cyan-400 text-xs font-bold uppercase tracking-wider">Total Shares</div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center text-cyan-400">✓</div>
            </div>
            <div className="text-2xl font-bold text-white">{formatNumber(braiinsData?.totalshares)}G</div>
            <div className="text-slate-400 text-xs mt-2">Cumulative</div>
            <div className="mt-3 h-1 bg-gradient-to-r from-cyan-500 to-transparent rounded-full"></div>
          </div>

          {/* Active Miners Card */}
          <div className="group relative rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur">
            <div className="flex items-start justify-between mb-3">
              <div className="text-purple-400 text-xs font-bold uppercase tracking-wider">Active Rigs</div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-purple-400">🖥</div>
            </div>
            <div className="text-2xl font-bold text-white">{activeMinersList.length}</div>
            <div className="text-slate-400 text-xs mt-2">Currently mining</div>
            <div className="mt-3 h-1 bg-gradient-to-r from-purple-500 to-transparent rounded-full"></div>
          </div>
        </div>

        {/* Active Miners Grid */}
        {activeMinersList.length > 0 && (
          <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-6 backdrop-blur">
            <h2 className="text-lg font-bold text-white mb-4">Active Mining Rigs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {activeMinersList.map((miner, idx) => (
                <div key={idx} className="group relative rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-cyan-400 font-bold text-sm">{miner.name}</div>
                      <div className="text-slate-400 text-xs mt-1">ID: {idx + 1}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">1m Rate:</span>
                      <span className="text-cyan-300 font-mono">{formatHashrate(miner.hashrate1m)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">5m Rate:</span>
                      <span className="text-purple-300 font-mono">{formatHashrate(miner.hashrate5m)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Best Share:</span>
                      <span className="text-cyan-300 font-mono">{formatNumber(miner.bestshare)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Info Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hashrate History */}
          <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-5 backdrop-blur">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Hashrate History</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded border border-slate-700/30 bg-slate-800/20">
                <span className="text-slate-400 text-sm">5m Average</span>
                <span className="text-cyan-400 font-mono font-bold">{formatHashrate(braiinsData?.hashrate5m)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded border border-slate-700/30 bg-slate-800/20">
                <span className="text-slate-400 text-sm">1h Average</span>
                <span className="text-purple-400 font-mono font-bold">{formatHashrate(braiinsData?.hashrate1hr)}</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-5 backdrop-blur">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Recent Alerts</h3>
            <div className="space-y-2 max-h-28 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-4">No alerts yet</div>
              ) : (
                alerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="p-2 rounded border-l-2 border-cyan-500 bg-cyan-500/5 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5">→</span>
                      <div>
                        <div className="text-cyan-300 font-medium">{alert.message}</div>
                        <div className="text-slate-500 text-xs mt-1">{new Date(alert.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/5 p-4 backdrop-blur">
            <div className="text-red-400 text-sm font-medium">Error: {error}</div>
          </div>
        )}
      </div>
    </div>
  )
}
