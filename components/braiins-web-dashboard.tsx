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

interface Alert {
  id: string
  type: 'best_share' | 'worker_offline'
  message: string
  createdAt: string
  sent?: boolean
}

export function BraiinsWebDashboard() {
  const address = process.env.NEXT_PUBLIC_BRAIINS_ADDRESS || ''
  const discordWebhook = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || ''

  const [braiinsData, setBraiinsData] = useState<BraiinsStats | null>(null)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Braiins Solo Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Address: {address.slice(0, 12)}...</p>
        </div>
        <div className="text-right">
          {lastUpdate && (
            <p className="text-xs text-gray-500">Last update: {lastUpdate.toLocaleTimeString()}</p>
          )}
          <p className={`text-sm font-semibold ${loading ? 'text-yellow-600' : 'text-green-600'}`}>
            {loading ? 'Loading...' : 'Live'}
          </p>
        </div>
      </div>

      {/* Stats Section */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">Error</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {braiinsData && (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <span className="text-sm text-gray-600">Best Share</span>
              <p className="text-xl font-bold text-blue-600 mt-1">{braiinsData.bestshare}</p>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <span className="text-sm text-gray-600">1m Hashrate</span>
              <p className="text-xl font-bold text-purple-600 mt-1">{braiinsData.hashrate1m}</p>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <span className="text-sm text-gray-600">Total Shares</span>
              <p className="text-xl font-bold text-green-600 mt-1">{braiinsData.totalshares}</p>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <span className="text-sm text-gray-600">Best Ever</span>
              <p className="text-xl font-bold text-orange-600 mt-1">{braiinsData.bestever}</p>
            </div>
          </div>

          {/* Hashrate History */}
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">Hashrate History</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">5m Hashrate:</span>
                <span className="font-mono">{braiinsData.hashrate5m}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">1h Hashrate:</span>
                <span className="font-mono">{braiinsData.hashrate1hr}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Alert Log */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold mb-4">Alert Log</h3>
        {alerts.length === 0 ? (
          <p className="text-xs text-gray-500">No alerts yet</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${alert.type === 'best_share' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                    {alert.type === 'best_share' ? 'New Best Share' : 'Offline'}
                  </span>
                  <span className={`text-xs ${alert.sent ? 'text-green-600' : 'text-gray-400'}`}>
                    {alert.sent ? '✓ Sent to Discord' : 'Pending'}
                  </span>
                </div>
                <p className="mt-1 text-xs font-mono text-gray-700">{alert.message}</p>
                <p className="mt-1 text-xs text-gray-500">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
