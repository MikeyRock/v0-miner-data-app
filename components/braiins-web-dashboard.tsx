'use client'

import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
  // All values are in TH/s from the API
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)} TH/s`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)} GH/s`
  return `${num.toFixed(2)} TH/s`
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

// Calculate estimated block reward (3.125 BTC) in USD
function estimateBTCReward(btcPrice: number): string {
  const BLOCK_REWARD = 3.125 // Current BTC block reward
  const usd = BLOCK_REWARD * btcPrice
  return usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function BraiinsWebDashboard() {
  const defaultAddress = process.env.NEXT_PUBLIC_BRAIINS_ADDRESS || ''
  const discordWebhook = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || ''

  const [address, setAddress] = useState(defaultAddress)
  const [braiinsData, setBraiinsData] = useState<BraiinsStats | null>(null)
  const [miners, setMiners] = useState<Miner[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [btcPrice, setBtcPrice] = useState<number>(0)
  const [networkDifficulty, setNetworkDifficulty] = useState<number>(138.96e12)
  const [bestShareHistory, setBestShareHistory] = useState<{ timestamp: number; bestshare: number }[]>([])
  const [hashRateHistory, setHashRateHistory] = useState<{ timestamp: number; hashrate1m: number; hashrate5m: number; hashrate1hr: number }[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [settingsAddress, setSettingsAddress] = useState(address)

  const prevBestShare = useRef<string>('')

  const fetchBtcPrice = async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setBtcPrice(data.bitcoin.usd || 0)
      }
    } catch (e) {
      console.log('[v0] BTC price fetch error:', e)
    }
  }

  const fetchNetworkDifficulty = async () => {
    try {
      const res = await fetch('https://mempool.space/api/v1/mining/difficulty-adjustment')
      if (res.ok) {
        const data = await res.json()
        // mempool.space returns difficulty as a number
        setNetworkDifficulty(data.difficulty || 138.96e12)
      }
    } catch (e) {
      console.log('[v0] Network difficulty fetch error:', e)
    }
  }

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
        // Track to history
        setBestShareHistory((prev) => [
          ...prev.slice(-59), // Keep last 60 data points
          { timestamp: Date.now(), bestshare: currentBestShare }
        ])
      }
      prevBestShare.current = currentBestShare.toString()

      // Track hashrate history
      setHashRateHistory((prev) => [
        ...prev.slice(-59), // Keep last 60 data points
        {
          timestamp: Date.now(),
          hashrate1m: parseFloat(data.hashrate1m?.toString() || '0'),
          hashrate5m: parseFloat(data.hashrate5m?.toString() || '0'),
          hashrate1hr: parseFloat(data.hashrate1hr?.toString() || '0'),
        }
      ])

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
    fetchBtcPrice()
    fetchNetworkDifficulty()
    const interval = setInterval(fetchBraiinsStats, 15000)
    const priceInterval = setInterval(fetchBtcPrice, 60000)
    const difficultyInterval = setInterval(fetchNetworkDifficulty, 300000) // Every 5 minutes
    return () => {
      clearInterval(interval)
      clearInterval(priceInterval)
      clearInterval(difficultyInterval)
    }
  }, [address])

  const activeMinersList = miners.filter(m => m.lastshare && (Date.now() - m.lastshare * 1000) < 300000)
  const bestShareNum = parseFloat(braiinsData?.bestshare || '0')
  const usdReward = estimateBTCReward(btcPrice)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 bg-slate-900/50">
        <div>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-orbitron), sans-serif', letterSpacing: '-0.02em', textShadow: '0 0 20px rgba(6,182,212,0.6), 0 0 40px rgba(168,85,247,0.4)' }}>BRAIINS</h1>
          <h2 className="text-lg font-bold text-cyan-300" style={{ fontFamily: 'var(--font-orbitron), sans-serif', letterSpacing: '0.1em', textShadow: '0 0 10px rgba(6,182,212,0.4)' }}>SOLO</h2>
          <p className="text-slate-400 text-xs mt-0.5">Mining Dashboard</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-cyan-400'}`}></div>
            <span className={`text-xs font-medium ${loading ? 'text-yellow-400' : 'text-cyan-400'}`}>
              {loading ? 'Updating...' : 'Live'}
            </span>
          </div>
          <button
            onClick={() => {
              setShowSettings(true)
              setSettingsAddress(address)
            }}
            className="p-1 rounded hover:bg-slate-800/50 transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-3 max-w-full mx-auto overflow-y-auto space-y-2">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Best Share Card */}
          <div className="group relative rounded-lg border border-cyan-500/50 bg-gradient-to-br from-cyan-950/60 via-slate-900/50 to-slate-950/60 p-2.5 hover:border-cyan-400/80 hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 backdrop-blur-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(6,182,212,0.4),transparent_70%)] blur-xl transition-all duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-1">
                <div className="text-cyan-300 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Best Share</div>
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-cyan-900 text-xs shadow-lg shadow-cyan-500/50 animate-pulse">📊</div>
              </div>
              <div className="text-lg font-black text-cyan-100 drop-shadow-lg">{formatNumber(braiinsData?.bestshare)}</div>
              <div className="text-slate-400 text-xs mt-0.5">Peak difficulty</div>
              <div className="mt-1 h-0.5 bg-gradient-to-r from-cyan-500 via-cyan-400 to-transparent rounded-full shadow-lg shadow-cyan-500/50"></div>
            </div>
          </div>

          {/* 1M Hashrate Card */}
          <div className="group relative rounded-lg border border-purple-500/50 bg-gradient-to-br from-purple-950/60 via-slate-900/50 to-slate-950/60 p-2.5 hover:border-purple-400/80 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 backdrop-blur-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(168,85,247,0.4),transparent_70%)] blur-xl transition-all duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-1">
                <div className="text-purple-300 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>1m Rate</div>
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-purple-900 text-xs shadow-lg shadow-purple-500/50 animate-pulse">⚡</div>
              </div>
              <div className="text-lg font-black text-purple-100 drop-shadow-lg">{formatHashrate(braiinsData?.hashrate1m)}</div>
              <div className="text-slate-400 text-xs mt-0.5">Current rate</div>
              <div className="mt-1 h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-transparent rounded-full shadow-lg shadow-purple-500/50"></div>
            </div>
          </div>

          {/* Total Shares Card */}
          <div className="group relative rounded-lg border border-cyan-500/50 bg-gradient-to-br from-cyan-950/60 via-slate-900/50 to-slate-950/60 p-2.5 hover:border-cyan-400/80 hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 backdrop-blur-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(6,182,212,0.4),transparent_70%)] blur-xl transition-all duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-1">
                <div className="text-cyan-300 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Total Shares</div>
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center text-cyan-900 text-xs shadow-lg shadow-cyan-500/50 animate-pulse">✓</div>
              </div>
              <div className="text-lg font-black text-cyan-100 drop-shadow-lg">{formatNumber(braiinsData?.totalshares)}G</div>
              <div className="text-slate-400 text-xs mt-0.5">Cumulative</div>
              <div className="mt-1 h-0.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-transparent rounded-full shadow-lg shadow-cyan-500/50"></div>
            </div>
          </div>

          {/* Active Miners Card */}
          <div className="group relative rounded-lg border border-orange-500/50 bg-gradient-to-br from-orange-950/60 via-slate-900/50 to-slate-950/60 p-2.5 hover:border-orange-400/80 hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 backdrop-blur-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(249,115,22,0.4),transparent_70%)] blur-xl transition-all duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-1">
                <div className="text-orange-300 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Active</div>
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center text-orange-900 text-xs shadow-lg shadow-orange-500/50 animate-bounce">🖥</div>
              </div>
              <div className="text-lg font-black text-orange-100 drop-shadow-lg">{activeMinersList.length}</div>
              <div className="text-slate-400 text-xs mt-0.5">Mining</div>
              <div className="mt-1 h-0.5 bg-gradient-to-r from-orange-500 via-red-500 to-transparent rounded-full shadow-lg shadow-orange-500/50"></div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          {/* Hashrate Trend Line Chart */}
          <div className="group relative rounded-lg border border-cyan-500/40 bg-gradient-to-br from-slate-800/40 to-slate-900/50 p-2 backdrop-blur-lg hover:border-cyan-400/70 hover:shadow-xl hover:shadow-cyan-500/40 transition-all">
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-15 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(6,182,212,0.3),transparent_70%)] blur-lg transition-all duration-300"></div>
            <h3 className="text-xs font-bold text-cyan-300 mb-1 uppercase tracking-widest relative z-10" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Hashrate Trend</h3>
            <div className="h-20 relative z-10">
              {hashRateHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hashRateHistory} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="hashRateGradient" x1="0%" y1="100%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                        <stop offset="50%" stopColor="#0891b2" stopOpacity={1} />
                        <stop offset="100%" stopColor="#06d6d4" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.1)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(20, 20, 40, 0.95)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '6px' }}
                      labelStyle={{ color: '#06d6d4' }}
                      formatter={(value: any) => formatHashrate(value as number)}
                    />
                    <YAxis hide domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                    <Line 
                      type="linear" 
                      dataKey="hashrate1m" 
                      stroke="url(#hashRateGradient)"
                      dot={false}
                      strokeWidth={3}
                      isAnimationActive={false}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="drop-shadow(0 0 6px rgba(6,182,212,0.8))"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  Waiting for hashrate data...
                </div>
              )}
            </div>
          </div>

          {/* Historical Best Share Progression */}
          <div className="group relative rounded-lg border border-purple-500/40 bg-gradient-to-br from-slate-800/40 to-slate-900/50 p-2 backdrop-blur-lg hover:border-purple-400/70 hover:shadow-xl hover:shadow-purple-500/40 transition-all">
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-15 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(168,85,247,0.3),transparent_70%)] blur-lg transition-all duration-300"></div>
            <h3 className="text-xs font-bold text-purple-300 mb-1 uppercase tracking-widest relative z-10" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Best Share Progression</h3>
            <div className="h-20 relative z-10">
              {bestShareHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bestShareHistory} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 113, 248, 0.1)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(20, 20, 40, 0.95)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px' }}
                      labelStyle={{ color: '#c084fc' }}
                      formatter={(value: any) => formatNumber(value)}
                    />
                    <YAxis hide domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                    <Line 
                      type="monotone" 
                      dataKey="bestshare" 
                      stroke="#d946ef" 
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                      filter="drop-shadow(0 0 4px rgba(217, 70, 239, 0.6))"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  Waiting for best share data...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BTC Reward Section */}
        <div className="rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/40 to-cyan-950/40 p-2 backdrop-blur hover:border-purple-400/50 transition-all">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="group">
              <div className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>USD Reward</div>
              <div className="text-lg font-bold text-white">{usdReward}</div>
              <div className="text-slate-400 text-xs mt-0.5">@ ${btcPrice.toLocaleString()}/BTC</div>
              <div className="mt-1 h-0.5 bg-gradient-to-r from-purple-500 to-transparent rounded-full group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-all"></div>
            </div>
            <div className="group">
              <div className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Best Share</div>
              <div className="text-lg font-bold text-white">{formatNumber(braiinsData?.bestshare)}</div>
              <div className="text-slate-400 text-xs mt-0.5">Current peak</div>
              <div className="mt-1 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent rounded-full group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-all"></div>
            </div>
            <div className="group">
              <div className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Network Diff</div>
              <div className="text-lg font-bold text-white">{(networkDifficulty / 1e12).toFixed(2)}T</div>
              <div className="text-slate-400 text-xs mt-0.5">Bitcoin network</div>
              <div className="mt-1 h-0.5 bg-gradient-to-r from-purple-500 to-transparent rounded-full group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-all"></div>
            </div>
          </div>
        </div>

        {/* Active Miners Grid */}
        {activeMinersList.length > 0 && (
          <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-800/30 to-slate-900/40 p-2 backdrop-blur">
            <h2 className="text-xs font-bold text-white mb-1" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Active Rigs ({activeMinersList.length})</h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-0.5">
              {activeMinersList.map((miner, idx) => (
                <div key={idx} className="group relative rounded border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-1 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-cyan-400 font-bold text-xs truncate">{miner.name}</div>
                    <div className="w-0.5 h-0.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0"></div>
                  </div>
                  
                  <div className="space-y-0.5 text-xs">
                    <div className="flex justify-between gap-0.5">
                      <span className="text-slate-500">1m:</span>
                      <span className="text-cyan-300 font-mono text-xs truncate">{formatHashrate(miner.hashrate1m)}</span>
                    </div>
                    <div className="flex justify-between gap-0.5">
                      <span className="text-slate-500">Best:</span>
                      <span className="text-cyan-300 font-mono text-xs">{formatNumber(miner.bestshare)}</span>
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
          <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-800/30 to-slate-900/40 p-5 backdrop-blur hover:border-cyan-400/50 transition-all">
            <h3 className="text-sm font-bold text-cyan-400 mb-4 uppercase tracking-wider" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Hashrate History</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all">
                <span className="text-slate-400 text-sm">5m Average</span>
                <span className="text-cyan-400 font-mono font-bold">{formatHashrate(braiinsData?.hashrate5m)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-all">
                <span className="text-slate-400 text-sm">1h Average</span>
                <span className="text-purple-400 font-mono font-bold">{formatHashrate(braiinsData?.hashrate1hr)}</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="rounded-lg border border-purple-500/30 bg-gradient-to-br from-slate-800/30 to-slate-900/40 p-5 backdrop-blur hover:border-purple-400/50 transition-all">
            <h3 className="text-sm font-bold text-purple-400 mb-4 uppercase tracking-wider" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Recent Alerts</h3>
            <div className="space-y-2 max-h-28">
              {alerts.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-4">No alerts yet</div>
              ) : (
                alerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="p-2 rounded border-l-2 border-purple-500 bg-purple-500/5 text-xs hover:bg-purple-500/10 transition-all">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400 mt-0.5">→</span>
                      <div>
                        <div className="text-purple-300 font-medium">{alert.message}</div>
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

        {/* MIKEYROCKS Footer Image */}
        <div className="mt-16 mb-8 flex flex-col items-center justify-center relative gap-2">
          {/* BTC MINING Label */}
          <div 
            className="text-xs font-bold tracking-[0.25em]" 
            style={{ 
              fontFamily: 'var(--font-orbitron), sans-serif',
              color: '#06b6d4',
              textShadow: `
                0 0 8px rgba(6, 182, 212, 0.5),
                0 0 16px rgba(6, 182, 212, 0.3)
              `,
              fontWeight: 900,
            }}
          >
            BTC MINING
          </div>
          
          {/* Footer Image */}
          <img 
            src="/images/mikeyrocks-footer.png" 
            alt="MIKEYROCKS BTC MINING" 
            className="h-16 w-auto object-contain drop-shadow-lg"
            style={{
              filter: 'drop-shadow(0 0 15px rgba(6, 182, 212, 0.4))',
            }}
          />
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl shadow-cyan-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-cyan-300" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-cyan-400 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-cyan-300 mb-2 uppercase tracking-widest" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>
                BTC Address
              </label>
              <input
                type="text"
                value={settingsAddress}
                onChange={(e) => setSettingsAddress(e.target.value)}
                placeholder="Enter BTC address"
                className="w-full bg-slate-800/50 border border-cyan-500/30 rounded px-3 py-2 text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              <p className="text-xs text-slate-400 mt-1">Current address: {address}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 rounded border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (settingsAddress.trim()) {
                    setAddress(settingsAddress.trim())
                    setBraiinsData(null)
                    setMiners([])
                    setBestShareHistory([])
                    setHashRateHistory([])
                    prevBestShare.current = ''
                    setShowSettings(false)
                  }
                }}
                className="flex-1 px-4 py-2 rounded bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-medium hover:from-cyan-500 hover:to-cyan-400 transition-all shadow-lg shadow-cyan-500/50"
              >
                Save &amp; Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
