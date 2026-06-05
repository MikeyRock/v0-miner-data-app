'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Customized } from 'recharts'
import confetti from 'canvas-confetti'

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
  type: 'best_share' | 'worker_offline' | 'braiins_rig_best'
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

// Absolute difficulty tier coloring — 11 bands + BTC block hit
// All colors are inline CSS so Tailwind purging never drops them
interface TierStyle {
  color: string        // text + dot color
  borderColor: string
  bgFrom: string       // gradient start (with alpha)
  glow: string         // box-shadow string (empty = no glow)
  pulse: boolean       // animate-pulse on the inner overlay
  label: string        // human-readable tier name
}

function getDifficultyTier(bestshare: number, networkDifficulty: number): TierStyle {
  const M = 1e6, G = 1e9, T = 1e12

  // BTC block difficulty hit — illuminating orange
  if (networkDifficulty > 0 && bestshare >= networkDifficulty)
    return { color: '#ff6a00', borderColor: '#ff6a00', bgFrom: 'rgba(255,106,0,0.22)', glow: '0 0 18px 6px rgba(255,106,0,0.75), 0 0 40px 10px rgba(255,106,0,0.4)', pulse: true, label: 'BTC DIFF!' }

  // Tier 11 — 121T → just under BTC diff (deep magenta/hot pink)
  if (bestshare >= 121 * T)
    return { color: '#f0abfc', borderColor: '#d946ef', bgFrom: 'rgba(217,70,239,0.18)', glow: '0 0 12px 4px rgba(217,70,239,0.6)', pulse: true, label: '121T+' }

  // Tier 10 — 101T – 120T (violet)
  if (bestshare >= 101 * T)
    return { color: '#c084fc', borderColor: '#a855f7', bgFrom: 'rgba(168,85,247,0.15)', glow: '0 0 10px 3px rgba(168,85,247,0.5)', pulse: true, label: '101T-120T' }

  // Tier 9 — 51T – 100T (blue-violet)
  if (bestshare >= 51 * T)
    return { color: '#818cf8', borderColor: '#6366f1', bgFrom: 'rgba(99,102,241,0.14)', glow: '0 0 8px 2px rgba(99,102,241,0.45)', pulse: false, label: '51T-100T' }

  // Tier 8 — 2T – 50T (indigo-blue)
  if (bestshare >= 2 * T)
    return { color: '#60a5fa', borderColor: '#3b82f6', bgFrom: 'rgba(59,130,246,0.13)', glow: '0 0 6px 2px rgba(59,130,246,0.35)', pulse: false, label: '2T-50T' }

  // Tier 7 — 500G – 1T (sky blue)
  if (bestshare >= 500 * G)
    return { color: '#38bdf8', borderColor: '#0ea5e9', bgFrom: 'rgba(14,165,233,0.12)', glow: '0 0 5px 1px rgba(14,165,233,0.3)', pulse: false, label: '500G-1T' }

  // Tier 6 — 101G – 499G (cyan)
  if (bestshare >= 101 * G)
    return { color: '#22d3ee', borderColor: '#06b6d4', bgFrom: 'rgba(6,182,212,0.11)', glow: '0 0 4px 1px rgba(6,182,212,0.25)', pulse: false, label: '101G-499G' }

  // Tier 5 — 51G – 100G (teal-cyan)
  if (bestshare >= 51 * G)
    return { color: '#2dd4bf', borderColor: '#14b8a6', bgFrom: 'rgba(20,184,166,0.10)', glow: '', pulse: false, label: '51G-100G' }

  // Tier 4 — 1G – 50G (teal-green)
  if (bestshare >= G)
    return { color: '#34d399', borderColor: '#10b981', bgFrom: 'rgba(16,185,129,0.09)', glow: '', pulse: false, label: '1G-50G' }

  // Tier 3 — 501M – 999M (lime-green)
  if (bestshare >= 501 * M)
    return { color: '#a3e635', borderColor: '#84cc16', bgFrom: 'rgba(132,204,22,0.09)', glow: '', pulse: false, label: '501M-999M' }

  // Tier 2 — 101M – 500M (yellow-green)
  if (bestshare >= 101 * M)
    return { color: '#facc15', borderColor: '#eab308', bgFrom: 'rgba(234,179,8,0.08)', glow: '', pulse: false, label: '101M-500M' }

  // Tier 1 — 0 – 100M (slate blue — cold/base)
  return { color: '#94a3b8', borderColor: '#475569', bgFrom: 'rgba(71,85,105,0.10)', glow: '', pulse: false, label: '0-100M' }
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
  const [rewardHistory, setRewardHistory] = useState<{ timestamp: number; usd: number }[]>([])
  const [hashRateHistory, setHashRateHistory] = useState<{ timestamp: number; hashrate1m: number; hashrate5m: number; hashrate1hr: number }[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [settingsAddress, setSettingsAddress] = useState(address)
  const [blockFound, setBlockFound] = useState(false)
  const blockFoundTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confettiRainInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const prevBestShare = useRef<string>('')
  const rigBestShares = useRef<Record<string, number>>({})

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
      }
      prevBestShare.current = currentBestShare.toString()

        // Block found — share meets or exceeds network difficulty
      if (currentBestShare > 0 && networkDifficulty > 0 && currentBestShare >= networkDifficulty) {
        triggerBlockFound()
      }

      // Track estimated reward history every fetch
      const hr1hr = parseFloat(data.hashrate1hr?.toString() || '0')
      if (hr1hr > 0 && networkDifficulty > 0) {
        const BLOCK_REWARD = 3.125
        const estimatedBtc = (hr1hr / networkDifficulty) * BLOCK_REWARD
        setRewardHistory((prev) => [
          ...prev.slice(-59),
          { timestamp: Date.now(), usd: estimatedBtc * btcPrice }
        ])
      }

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
        
        // Check each rig for new personal best shares
        minersList.forEach((miner) => {
          const rigKey = miner.name
          const prevRigBest = rigBestShares.current[rigKey] ?? null
          const currentRigBest = miner.bestshare || 0
          
          // Fire alert if: (1) we have a previous best and it's being beaten, OR (2) this is a new personal best and we haven't seen it before
          if (currentRigBest > 0 && (prevRigBest === null || currentRigBest > prevRigBest)) {
            const message = `**${miner.name}** just hit a new personal best: ${formatNumber(currentRigBest)}`
            createAlert('braiins_rig_best', message, miner.name)
          }
          rigBestShares.current[rigKey] = currentRigBest
        })
        
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

  const sendDiscordAlert = async (message: string, type: 'best_share' | 'braiins_rig_best' | 'worker_offline', deviceName?: string) => {
    if (!discordWebhook) return
    try {
      const titles: Record<string, string> = {
        'best_share': '⚡ New Best Share!',
        'braiins_rig_best': `🎯 ${deviceName} — New Personal Best!`,
        'worker_offline': '⚠ Worker Offline',
      }
      const colors: Record<string, number> = {
        'best_share': 3066993,      // blue
        'braiins_rig_best': 1681177, // cyan
        'worker_offline': 15158332,  // red
      }
      await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: titles[type],
            description: message,
            color: colors[type],
            footer: { text: 'Braiins Solo Mining' },
            timestamp: new Date().toISOString(),
          }],
        }),
      })
    } catch (e) {
      console.log('[v0] Discord error:', e)
    }
  }

  const createAlert = async (type: 'best_share' | 'braiins_rig_best' | 'worker_offline', message: string, deviceName?: string) => {
    const alert: Alert = {
      id: Date.now().toString(),
      type,
      message,
      createdAt: new Date().toISOString(),
      sent: true,
    }
    setAlerts((prev) => [alert, ...prev.slice(0, 19)])
    await sendDiscordAlert(message, type, deviceName)
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

  const dismissBlockFound = useCallback(() => {
    setBlockFound(false)
    if (blockFoundTimeout.current) clearTimeout(blockFoundTimeout.current)
    if (confettiRainInterval.current) { clearInterval(confettiRainInterval.current); confettiRainInterval.current = null }
  }, [])

  const triggerBlockFound = useCallback(() => {
    setBlockFound(true)
    // Initial multi-cannon burst
    confetti({ particleCount: 250, spread: 160, origin: { x: 0.5, y: 0.5 }, startVelocity: 55, colors: ['#facc15', '#fbbf24', '#f97316', '#06b6d4', '#a855f7', '#ffffff'] })
    setTimeout(() => confetti({ particleCount: 180, angle: 60,  spread: 80, origin: { x: 0,   y: 0.6 }, startVelocity: 60, colors: ['#facc15', '#06b6d4', '#ffffff', '#a855f7'] }), 200)
    setTimeout(() => confetti({ particleCount: 180, angle: 120, spread: 80, origin: { x: 1,   y: 0.6 }, startVelocity: 60, colors: ['#facc15', '#f97316', '#ffffff', '#06b6d4'] }), 400)
    setTimeout(() => confetti({ particleCount: 300, spread: 200, origin: { x: 0.5, y: 0 }, startVelocity: 20, gravity: 0.8, colors: ['#facc15', '#fbbf24', '#fde68a', '#ffffff'] }), 600)
    setTimeout(() => confetti({ particleCount: 200, spread: 140, origin: { x: 0.5, y: 0.4 }, startVelocity: 70, colors: ['#06b6d4', '#a855f7', '#facc15', '#f97316', '#ffffff'] }), 1000)
    // Continuous rain — steady stream of gold from top while overlay is visible
    if (confettiRainInterval.current) clearInterval(confettiRainInterval.current)
    confettiRainInterval.current = setInterval(() => {
      confetti({ particleCount: 18, spread: 180, origin: { x: Math.random(), y: -0.05 }, startVelocity: 14, gravity: 0.55, drift: (Math.random() - 0.5) * 0.6, colors: ['#facc15', '#fbbf24', '#fde68a', '#ffffff', '#06b6d4', '#a855f7'], scalar: 0.9 })
    }, 220)
    // Auto-dismiss after 12 s
    if (blockFoundTimeout.current) clearTimeout(blockFoundTimeout.current)
    blockFoundTimeout.current = setTimeout(() => {
      setBlockFound(false)
      if (confettiRainInterval.current) { clearInterval(confettiRainInterval.current); confettiRainInterval.current = null }
    }, 12000)
  }, [])

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
          <div className="flex items-center gap-1">
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
            <button
              onClick={() => triggerBlockFound()}
              className="p-1 rounded hover:bg-slate-800/50 transition-colors"
              title="Preview Block Found"
            >
              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </button>
          </div>
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
          <div className="group relative rounded-lg border border-cyan-500/40 bg-gradient-to-br from-slate-800/40 to-slate-900/50 p-2 backdrop-blur-lg hover:border-cyan-400/70 hover:shadow-xl hover:shadow-cyan-500/40 transition-all overflow-hidden">
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-15 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(6,182,212,0.3),transparent_70%)] blur-lg transition-all duration-300"></div>
            <h3 className="text-xs font-bold text-cyan-300 mb-1 uppercase tracking-widest relative z-10" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Hashrate Trend</h3>
            <div className="h-20 relative z-10">
              {hashRateHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hashRateHistory} margin={{ top: 5, right: 18, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="hashRateGradient" x1="0%" y1="100%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                        <stop offset="50%" stopColor="#0891b2" stopOpacity={1} />
                        <stop offset="100%" stopColor="#06d6d4" stopOpacity={1} />
                      </linearGradient>
                      {/* Laser beam gradient: bright white core fading left */}
                      <linearGradient id="laserBeam" x1="100%" y1="0%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
                        <stop offset="60%" stopColor="#06b6d4" stopOpacity={0.5} />
                        <stop offset="90%" stopColor="#06b6d4" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
                      </linearGradient>
                      <filter id="laserGlowFilter">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                      <filter id="coreGlowFilter">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
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
                      activeDot={false}
                      strokeWidth={2.5}
                      isAnimationActive={false}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="drop-shadow(0 0 6px rgba(6,182,212,0.8))"
                    />
                    {/* Laser head at the tip — uses Recharts' own scales for pixel-perfect positioning */}
                    <Customized component={(props: any) => {
                      const { xAxisMap, yAxisMap, offset } = props
                      const xScale = xAxisMap && Object.values(xAxisMap)[0] as any
                      const yScale = yAxisMap && Object.values(yAxisMap)[0] as any
                      if (!xScale || !yScale || hashRateHistory.length === 0) return null
                      const last = hashRateHistory[hashRateHistory.length - 1]
                      const cx = (offset?.left ?? 0) + (offset?.width ?? 0)
                      const cy = yScale.scale ? yScale.scale(last.hashrate1m) : (yScale as any)(last.hashrate1m)
                      if (cx == null || cy == null || isNaN(cy)) return null
                      return (
                        <g>
                          {/* Beam fading left from the tip */}
                          <defs>
                            <linearGradient id="laserBeamCustom" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0} />
                              <stop offset="70%" stopColor="#06b6d4" stopOpacity={0.6} />
                              <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <line x1={cx - 150} y1={cy} x2={cx} y2={cy} stroke="url(#laserBeamCustom)" strokeWidth={2} />
                          <line x1={cx - 70} y1={cy} x2={cx} y2={cy} stroke="#ffffff" strokeWidth={0.7} opacity={0.6} />
                          {/* Corona glow */}
                          <circle cx={cx} cy={cy} r={9} fill="rgba(6,182,212,0.12)" />
                          <circle cx={cx} cy={cy} r={5} fill="rgba(6,182,212,0.35)" />
                          <circle cx={cx} cy={cy} r={2.5} fill="rgba(255,255,255,0.95)" />
                          <circle cx={cx} cy={cy} r={1} fill="#ffffff" />
                        </g>
                      )
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  Waiting for hashrate data...
                </div>
              )}
            </div>
          </div>

          {/* Block Progress Bar */}
          <div className="group relative rounded-lg border border-cyan-500/40 bg-gradient-to-br from-slate-800/40 to-slate-900/50 p-3 backdrop-blur-lg hover:border-cyan-400/70 hover:shadow-xl hover:shadow-cyan-500/40 transition-all">
            <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-15 bg-[radial-gradient(ellipse_at_50%_50%,_rgba(6,182,212,0.3),transparent_70%)] blur-lg transition-all duration-300"></div>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-2 relative z-10">
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-widest" style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}>Block Progress</h3>
              <div className="text-xs text-cyan-400 font-mono">
                {braiinsData?.bestshare && networkDifficulty > 0
                  ? `${((Number(braiinsData.bestshare) / networkDifficulty) * 100).toFixed(2)}%`
                  : '0%'}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative z-10">
              <div className="h-8 rounded-lg bg-slate-900/60 border border-cyan-500/20 overflow-hidden">
                {/* Animated fill */}
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-300 rounded-lg transition-all duration-1000 ease-out"
                  style={{
                    width: braiinsData?.bestshare && networkDifficulty > 0
                      ? `${Math.min((Number(braiinsData.bestshare) / networkDifficulty) * 100, 100)}%`
                      : '0%',
                  }}
                >
                  {/* Shimmer effect */}
                  <div
                    className="h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                    style={{ animation: 'shimmer 2s infinite' }}
                  />
                </div>
              </div>

              {/* Progress text overlay */}
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                {braiinsData?.bestshare ? formatNumber(braiinsData.bestshare) : '0'} / {formatNumber(networkDifficulty)}
              </div>
            </div>

            {/* Time to block estimate in bottom right */}
            {(() => {
              // Get current 1m hashrate from the most recent entry
              const currentHashrate = hashRateHistory.length > 0 
                ? Number(hashRateHistory[hashRateHistory.length - 1].hashrate1m)
                : 0
              
              // Calculate remaining difficulty
              const remaining = Math.max(networkDifficulty - (Number(braiinsData?.bestshare) || 0), 0)
              
              // Estimate time in seconds: remaining_diff / hashrate
              const estimatedSeconds = currentHashrate > 0 ? remaining / currentHashrate : Infinity
              
              // Convert to human-readable format
              let timeStr = '—'
              if (isFinite(estimatedSeconds)) {
                if (estimatedSeconds < 60) {
                  timeStr = `${Math.round(estimatedSeconds)}s`
                } else if (estimatedSeconds < 3600) {
                  timeStr = `${Math.round(estimatedSeconds / 60)}m`
                } else if (estimatedSeconds < 86400) {
                  timeStr = `${Math.round(estimatedSeconds / 3600)}h`
                } else {
                  timeStr = `${Math.round(estimatedSeconds / 86400)}d`
                }
              }
              
              return (
                <div className="mt-2 text-right text-xs text-cyan-400 font-mono relative z-10">
                  <div className="text-slate-500 text-xs mb-0.5">Est. Time to Block</div>
                  <div className="text-lg font-bold text-cyan-300">{timeStr}</div>
                </div>
              )
            })()}
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
              {activeMinersList.map((miner, idx) => {
                const tier = getDifficultyTier(miner.bestshare, networkDifficulty)
                return (
                  <div
                    key={idx}
                    className="group relative rounded p-1 text-xs transition-all duration-500"
                    style={{
                      border: `1px solid ${tier.borderColor}`,
                      background: `linear-gradient(135deg, ${tier.bgFrom} 0%, rgba(15,23,42,0.85) 100%)`,
                      boxShadow: tier.glow || undefined,
                    }}
                  >
                    {/* Pulse overlay for hot tiers */}
                    {tier.pulse && (
                      <div
                        className="absolute inset-0 rounded animate-pulse pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at 50% 50%, ${tier.borderColor}22 0%, transparent 70%)` }}
                      />
                    )}
                    <div className="flex items-center justify-between mb-0.5 relative z-10">
                      <div className="font-bold text-xs truncate" style={{ color: tier.color }}>{miner.name}</div>
                      <div
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tier.pulse ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: tier.color, boxShadow: `0 0 4px ${tier.color}` }}
                      />
                    </div>
                    <div className="space-y-0.5 relative z-10">
                      <div className="flex justify-between gap-0.5">
                        <span className="text-slate-500">1m:</span>
                        <span className="font-mono text-xs truncate" style={{ color: tier.color }}>{formatHashrate(miner.hashrate1m)}</span>
                      </div>
                      <div className="flex justify-between gap-0.5">
                        <span className="text-slate-500">Best:</span>
                        <span className="font-mono text-xs" style={{ color: tier.color }}>{formatNumber(miner.bestshare)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
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
                    setRewardHistory([])
                    setHashRateHistory([])
                    prevBestShare.current = ''
                    rigBestShares.current = {}
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

      {/* BLOCK FOUND overlay */}
      {blockFound && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ animation: 'screenShake 0.15s ease-in-out 3' }}>
          {/* Dark backdrop */}
          <div className="absolute inset-0 bg-black/75 pointer-events-none" />
          {/* Full-screen flash */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.12) 0%, transparent 70%)', animation: 'blockFlash 0.5s ease-in-out infinite alternate' }} />
          {/* Scanlines */}
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 4px)' }} />
          {/* Outer border ring */}
          <div className="absolute inset-3 rounded-2xl border-2 border-yellow-300/80 pointer-events-none" style={{ boxShadow: '0 0 50px 10px rgba(250,204,21,0.35), inset 0 0 50px 10px rgba(250,204,21,0.08)', animation: 'blockFlash 0.5s ease-in-out infinite alternate' }} />
          {/* Corner brackets */}
          {(['top-5 left-5', 'top-5 right-5 rotate-90', 'bottom-5 left-5 -rotate-90', 'bottom-5 right-5 rotate-180'] as const).map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-10 h-10 border-t-2 border-l-2 border-yellow-300 pointer-events-none`} style={{ boxShadow: '0 0 10px rgba(250,204,21,0.8)' }} />
          ))}

          {/* Main content */}
          <div className="relative flex flex-col items-center gap-4 px-8 text-center" style={{ animation: 'blockTextPulse 0.45s ease-in-out infinite alternate' }}>
            {/* BTC icons */}
            <div className="text-5xl font-black" style={{ fontFamily: 'var(--font-orbitron), sans-serif', color: '#facc15', textShadow: '0 0 20px rgba(250,204,21,0.9)', letterSpacing: '0.4em' }}>
              ₿ ₿ ₿
            </div>
            {/* Headline — single line */}
            <div className="font-black leading-none whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-orbitron), sans-serif',
                fontSize: 'clamp(2.5rem, 8vw, 6rem)',
                color: '#facc15',
                textShadow: '0 0 20px rgba(250,204,21,1), 0 0 50px rgba(250,204,21,0.7), 0 0 90px rgba(250,204,21,0.4), -2px -2px 0 rgba(251,146,60,0.7), 2px 2px 0 rgba(251,146,60,0.7)',
              }}>
              BTC BLOCK FOUND!
            </div>
            {/* Sub-line */}
            <div className="font-bold tracking-[0.3em] text-cyan-300"
              style={{ fontFamily: 'var(--font-orbitron), sans-serif', fontSize: 'clamp(0.7rem, 2vw, 1.1rem)', textShadow: '0 0 12px rgba(6,182,212,0.9)' }}>
              YOU SOLVED THE BLOCK
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={dismissBlockFound}
            className="relative mt-12 px-10 py-3 rounded border-2 border-yellow-400/60 font-bold tracking-widest text-sm text-yellow-300 transition-all hover:bg-yellow-400/10 hover:border-yellow-300 active:scale-95"
            style={{ fontFamily: 'var(--font-orbitron), sans-serif', boxShadow: '0 0 20px rgba(250,204,21,0.25)' }}
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Global keyframe animations */}
      <style>{`
        @keyframes blockFlash {
          from { opacity: 0.4; }
          to   { opacity: 1;   }
        }
        @keyframes blockTextPulse {
          from { transform: scale(0.96) skewX(-1deg); filter: brightness(0.9); }
          to   { transform: scale(1.04) skewX(1deg);  filter: brightness(1.2); }
        }
        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0);       }
          20%      { transform: translate(-4px, 2px);  }
          40%      { transform: translate(4px, -2px);  }
          60%      { transform: translate(-3px, 3px);  }
          80%      { transform: translate(3px, -1px);  }
        }
      `}</style>
    </div>
  )
}
