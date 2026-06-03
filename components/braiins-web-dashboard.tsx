'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { BraiinsStats } from '@/app/api/braiins-web/route'
import { Alert as AlertType } from '@/lib/db/schema'

export function DashboardClient() {
  const [braiinsData, setBraiinsData] = useState<BraiinsStats | null>(null)
  const [alerts, setAlerts] = useState<AlertType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const prevBestDiff = useRef<number>(0)
  const seenOnlineWorkers = useRef<Set<string>>(new Set())
  const offlineAlerted = useRef<Set<string>>(new Set())

  const braiinsAddress = process.env.NEXT_PUBLIC_BRAIINS_ADDRESS || ''
  const discordWebhook = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || ''

  // Fetch Braiins data
  const fetchBraiinsData = useCallback(async () => {
    if (!braiinsAddress) {
      setError('BRAIINS_ADDRESS environment variable is not set')
      return
    }

    try {
      const res = await fetch(`/api/braiins-web?address=${encodeURIComponent(braiinsAddress)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      setBraiinsData(data)
      setError(null)

      // Check for best difficulty alert
      if (data.bestDifficulty > 0 && data.bestDifficulty > prevBestDiff.current && prevBestDiff.current > 0) {
        const message = `New best difficulty: ${data.bestDifficulty}`
        await createAlert('best_difficulty', message, data.bestDifficulty)
      }
      prevBestDiff.current = data.bestDifficulty

      // Check for worker offline
      data.workers?.forEach((w: any) => {
        if (w.hashrate > 0) {
          seenOnlineWorkers.current.add(w.name)
          offlineAlerted.current.delete(w.name)
        } else if (seenOnlineWorkers.current.has(w.name) && !offlineAlerted.current.has(w.name)) {
          offlineAlerted.current.add(w.name)
          createAlert('worker_offline', `Worker ${w.name} offline`, null)
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Braiins data')
    }
  }, [braiinsAddress])

  // Create alert
  const createAlert = useCallback(
    async (type: string, message: string, bestDifficulty: number | null) => {
      try {
        await fetch('/api/alerts-web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, message, bestDifficulty, discordUrl: discordWebhook }),
        })
        fetchAlerts()
      } catch (err) {
        console.error('[v0] Create alert error:', err)
      }
    },
    [discordWebhook],
  )

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts-web')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAlerts(data)
    } catch (err) {
      console.error('[v0] Fetch alerts error:', err)
    }
  }, [])

  // Poll Braiins data every 15 seconds
  useEffect(() => {
    fetchBraiinsData()
    fetchAlerts()
    setLoading(false)

    const interval = setInterval(() => {
      setIsRefreshing(true)
      Promise.all([fetchBraiinsData(), fetchAlerts()]).finally(() => setIsRefreshing(false))
    }, 15000)

    return () => clearInterval(interval)
  }, [fetchBraiinsData, fetchAlerts])

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div className="space-y-8 p-8">
      {/* Braiins Stats */}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      ) : braiinsData ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Braiins Solo Mining</h2>
            <span className={`text-sm ${isRefreshing ? 'text-yellow-600' : 'text-green-600'}`}>
              {isRefreshing ? 'Updating...' : 'Live'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Best Difficulty */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <span className="text-sm text-gray-600">Best Difficulty</span>
              <p className="text-2xl font-bold text-blue-600">{braiinsData.bestDifficulty.toLocaleString()}</p>
            </div>

            {/* Hashrate */}
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <span className="text-sm text-gray-600">Total Hashrate</span>
              <p className="text-2xl font-bold text-purple-600">{braiinsData.totalHashrate}</p>
            </div>

            {/* Shares */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <span className="text-sm text-gray-600">Total Shares</span>
              <p className="text-2xl font-bold text-green-600">{braiinsData.totalShares.toLocaleString()}</p>
            </div>

            {/* Workers */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <span className="text-sm text-gray-600">Active Workers</span>
              <p className="text-2xl font-bold text-orange-600">{braiinsData.workersCount}</p>
            </div>
          </div>

          {/* Workers List */}
          {braiinsData.workers && braiinsData.workers.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-4 font-semibold">Workers</h3>
              <div className="space-y-2">
                {braiinsData.workers.map((w) => (
                  <div key={w.name} className="flex items-center justify-between text-sm">
                    <span className={w.hashrate > 0 ? 'text-green-700' : 'text-red-700'}>{w.name}</span>
                    <span className={w.hashrate > 0 ? 'text-green-600' : 'text-red-600'}>{w.hashrate === 0 ? 'Offline' : w.hashrate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Alert Log */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Recent Alerts</h2>
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <p className="text-gray-500">No alerts yet</p>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="flex items-start justify-between rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex-1">
                  <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${alert.type === 'best_difficulty' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                    {alert.type}
                  </span>
                  <p className="mt-1">{alert.message}</p>
                  <p className="mt-1 text-xs text-gray-500">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
                {alert.discordSent && <span className="ml-2 text-xs text-green-600">✓ Sent</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
