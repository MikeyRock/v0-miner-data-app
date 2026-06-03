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
    <div className="min-h-screen bg-black text-white font-mono overflow-hidden" style={{
      backgroundImage: `repeating-linear-gradient(
        0deg,
        rgba(0, 255, 255, 0.03) 0px,
        rgba(0, 255, 255, 0.03) 1px,
        transparent 1px,
        transparent 2px
      ),
      repeating-linear-gradient(
        90deg,
        rgba(0, 255, 255, 0.03) 0px,
        rgba(0, 255, 255, 0.03) 1px,
        transparent 1px,
        transparent 2px
      )`
    }}>
      {/* Scanlines effect */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, 0.15) 0px,
          rgba(0, 0, 0, 0.15) 1px,
          transparent 1px,
          transparent 2px
        )`
      }}></div>

      <div className="relative z-10 p-4">
        {/* Header */}
        <div className="border-2 border-yellow-400 bg-black/80 p-3 mb-4 relative" style={{
          boxShadow: '0 0 20px rgba(255, 255, 0, 0.3), inset 0 0 20px rgba(255, 255, 0, 0.1)'
        }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-yellow-400 text-sm font-bold tracking-widest">⚠ CYBERPUNK MINER ⚠</div>
            <div className="flex gap-2">
              <div className={`w-2 h-2 ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-cyan-400'}`}></div>
              <span className="text-cyan-400 text-xs">{loading ? 'SYNC' : 'LIVE'}</span>
            </div>
          </div>
          <div className="text-cyan-300 text-xs">WALLET: {address.slice(0, 10)}...</div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {/* Best Share */}
          <div className="border-2 border-cyan-400 bg-black/80 p-3 relative group" style={{
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.3), inset 0 0 15px rgba(0, 255, 255, 0.05)'
          }}>
            <div className="text-yellow-400 text-xs font-bold mb-1">▐ BEST_SHARE</div>
            <div className="text-cyan-300 text-lg font-bold">{formatNumber(braiinsData?.bestshare)}</div>
            <div className="mt-1 h-0.5 w-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-transparent"></div>
          </div>

          {/* 1M Hashrate */}
          <div className="border-2 border-yellow-400 bg-black/80 p-3 relative" style={{
            boxShadow: '0 0 15px rgba(255, 255, 0, 0.3), inset 0 0 15px rgba(255, 255, 0, 0.05)'
          }}>
            <div className="text-cyan-400 text-xs font-bold mb-1">▌ 1M_RATE</div>
            <div className="text-yellow-300 text-lg font-bold">{formatHashrate(braiinsData?.hashrate1m)}</div>
            <div className="mt-1 h-0.5 w-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-transparent"></div>
          </div>

          {/* Total Shares */}
          <div className="border-2 border-cyan-500 bg-black/80 p-3 relative" style={{
            boxShadow: '0 0 15px rgba(0, 255, 200, 0.3), inset 0 0 15px rgba(0, 255, 200, 0.05)'
          }}>
            <div className="text-yellow-400 text-xs font-bold mb-1">▐ TOT_SHARES</div>
            <div className="text-cyan-300 text-lg font-bold">{formatNumber(braiinsData?.totalshares)}G</div>
            <div className="mt-1 h-0.5 w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-transparent"></div>
          </div>

          {/* Active Miners */}
          <div className="border-2 border-yellow-500 bg-black/80 p-3 relative" style={{
            boxShadow: '0 0 15px rgba(255, 200, 0, 0.3), inset 0 0 15px rgba(255, 200, 0, 0.05)'
          }}>
            <div className="text-cyan-400 text-xs font-bold mb-1">▌ ACTIVE</div>
            <div className="text-yellow-300 text-lg font-bold">{activeMinersList.length}</div>
            <div className="mt-1 h-0.5 w-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-transparent"></div>
          </div>
        </div>

        {/* Miners Grid */}
        {activeMinersList.length > 0 && (
          <div className="border-2 border-cyan-400 bg-black/80 p-3 mb-4" style={{
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.2), inset 0 0 20px rgba(0, 255, 255, 0.05)'
          }}>
            <div className="text-yellow-400 text-xs font-bold mb-3 tracking-widest">▐▐ ACTIVE_MINING_RIGS ({activeMinersList.length}) ▐▐</div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {activeMinersList.map((miner, idx) => (
                <div key={idx} className="border border-cyan-500/60 bg-black/60 p-2 text-xs" style={{
                  boxShadow: 'inset 0 0 10px rgba(0, 255, 255, 0.1)'
                }}>
                  <div className="text-cyan-300 font-bold mb-1">{miner.name}</div>
                  <div className="grid grid-cols-2 gap-1 text-cyan-400/80">
                    <div>1M: <span className="text-yellow-400">{formatHashrate(miner.hashrate1m)}</span></div>
                    <div>5M: <span className="text-yellow-400">{formatHashrate(miner.hashrate5m)}</span></div>
                    <div className="col-span-2">Best: <span className="text-cyan-300">{formatNumber(miner.bestshare)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Panels */}
        <div className="grid grid-cols-2 gap-2">
          {/* Hashrate History */}
          <div className="border-2 border-yellow-400 bg-black/80 p-3" style={{
            boxShadow: '0 0 15px rgba(255, 255, 0, 0.2), inset 0 0 15px rgba(255, 255, 0, 0.05)'
          }}>
            <div className="text-cyan-400 text-xs font-bold mb-2">▌ HASHRATE_HISTORY</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-cyan-400">
                <span>5M:</span>
                <span className="text-yellow-400">{formatHashrate(braiinsData?.hashrate5m)}</span>
              </div>
              <div className="flex justify-between text-cyan-400">
                <span>1H:</span>
                <span className="text-yellow-400">{formatHashrate(braiinsData?.hashrate1hr)}</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="border-2 border-cyan-500 bg-black/80 p-3" style={{
            boxShadow: '0 0 15px rgba(0, 255, 255, 0.2), inset 0 0 15px rgba(0, 255, 255, 0.05)'
          }}>
            <div className="text-yellow-400 text-xs font-bold mb-2">▐ ALERT_LOG ({alerts.length})</div>
            <div className="space-y-1 text-xs max-h-20 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-cyan-400/60">[ NO ALERTS ]</div>
              ) : (
                alerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="text-cyan-300 border-l-2 border-yellow-400 pl-1">
                    <span className="text-yellow-400">[{alert.type === 'best_share' ? '✓' : '!'}]</span> {alert.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 border-2 border-red-500 bg-red-900/20 p-3" style={{
            boxShadow: '0 0 20px rgba(255, 0, 0, 0.3)'
          }}>
            <div className="text-red-400 text-xs font-bold">ERROR: {error}</div>
          </div>
        )}
      </div>
    </div>
  )
}
