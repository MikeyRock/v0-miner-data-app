'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './header'
import { StatCard } from './stat-card'
import { ProgressBlock } from './progress-block'
import { WorkerTable } from './worker-table'
import { AlertLog } from './alert-log'
import type { AlertEvent, NodeStats } from '@/lib/types'

const POLL_INTERVAL_MS = parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? '15000', 10)
const OFFLINE_THRESHOLD_S = parseInt(process.env.NEXT_PUBLIC_OFFLINE_THRESHOLD_S ?? '300', 10)
const MILESTONES = [25, 50, 75, 90]

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

async function sendDiscordAlert(payload: Record<string, unknown>) {
  try {
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Silently fail — alert is still logged locally
  }
}

export function DashboardClient() {
  const [data, setData] = useState<NodeStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [alerts, setAlerts] = useState<AlertEvent[]>([])

  // Persistent state for alert deduplication
  const prevBestShareRef = useRef<Record<string, number>>({})
  const offlineAlertedRef = useRef<Set<string>>(new Set())
  const milestoneAlertedRef = useRef<Set<number>>(new Set())
  const blockFoundAlertedRef = useRef<Set<number>>(new Set())

  const addAlert = useCallback((event: Omit<AlertEvent, 'id'>) => {
    const full: AlertEvent = { ...event, id: generateId() }
    setAlerts((prev) => [...prev.slice(-99), full])
    return full
  }, [])

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      const res = await fetch('/api/mining', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `HTTP ${res.status}`)
        return
      }
      const json: NodeStats = await res.json()
      setError(null)
      setData(json)

      // ---------- Alert engine ----------

      // 1. ATH per worker
      json.workers.forEach((w) => {
        const prev = prevBestShareRef.current[w.workerId] ?? 0
        if (w.bestShareRaw > prev && prev > 0) {
          const alert = addAlert({
            type: 'ath',
            message: `${w.workerId} just hit a new best share: ${w.bestShare}${w.bestShareUnit} (block diff: ${json.blockDiff}${json.blockDiffUnit})`,
            workerName: w.workerId,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({
            type: 'ath',
            workerName: w.workerId,
            bestShare: `${w.bestShare}${w.bestShareUnit}`,
            blockDiff: `${json.blockDiff}${json.blockDiffUnit}`,
          }).then(() => {
            setAlerts((prev) =>
              prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a))
            )
          })
        }
        prevBestShareRef.current[w.workerId] = w.bestShareRaw
      })

      // 2. Worker offline
      json.workers.forEach((w) => {
        if (!w.isOnline && !offlineAlertedRef.current.has(w.workerId)) {
          offlineAlertedRef.current.add(w.workerId)
          const alert = addAlert({
            type: 'worker_offline',
            message: `Worker ${w.workerId} has gone offline (no share for ${Math.floor(w.lastShareAgo / 60)}m)`,
            workerName: w.workerId,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({
            type: 'worker_offline',
            workerName: w.workerId,
            lastShareAgo: w.lastShareAgo,
          }).then(() => {
            setAlerts((prev) =>
              prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a))
            )
          })
        }
        // Re-arm when worker comes back online
        if (w.isOnline) offlineAlertedRef.current.delete(w.workerId)
      })

      // 3. Progress milestones
      MILESTONES.forEach((m) => {
        if (json.progressPercent >= m && !milestoneAlertedRef.current.has(m)) {
          milestoneAlertedRef.current.add(m)
          const alert = addAlert({
            type: 'milestone',
            message: `Progress milestone reached: ${m}% of the way to solving block #${json.height + 1}. ETA: ${json.etaDays}d ${json.etaHours}h`,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({
            type: 'milestone',
            progressPercent: m,
            etaDays: json.etaDays,
            etaHours: json.etaHours,
          }).then(() => {
            setAlerts((prev) =>
              prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a))
            )
          })
        }
        // Re-arm on new block (progress resets below milestone)
        if (json.progressPercent < m - 5) milestoneAlertedRef.current.delete(m)
      })

      // 4. Block found (progress resets near 0 unexpectedly or we detect a height jump)
      // We detect when progress drops drastically which implies a block was found
      if (
        json.progressPercent < 1 &&
        json.height > 0 &&
        !blockFoundAlertedRef.current.has(json.height)
      ) {
        blockFoundAlertedRef.current.add(json.height)
        if (blockFoundAlertedRef.current.size > 1) {
          // Only alert after the first poll (skip initial load)
          const alert = addAlert({
            type: 'block_found',
            message: `Block #${json.height} found! The pool solved a block.`,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({ type: 'block_found', height: json.height }).then(() => {
            setAlerts((prev) =>
              prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a))
            )
          })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      if (showSpinner) setIsRefreshing(false)
    }
  }, [addAlert])

  // Initial fetch + polling
  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  const isConnected = !!data && !error
  const athWorkerIds = new Set(
    data?.workers
      .filter((w) => w.bestShareRaw === (data?.bestShareRaw ?? 0) && w.bestShareRaw > 0)
      .map((w) => w.workerId) ?? []
  )

  // Compute the latest lastShareAgo across all online workers
  const latestShareAgo =
    data?.workers
      .filter((w) => w.isOnline)
      .reduce((min, w) => Math.min(min, w.lastShareAgo), Infinity) ?? 0

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <Header
        isConnected={isConnected}
        lastUpdated={data?.timestamp ?? null}
        onRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 p-4 md:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Connection error: {error} — check that <code className="font-mono">AXEBCH_API_URL</code> is reachable.
          </div>
        )}

        {/* Top stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
          <StatCard
            label="Block Height"
            value={data ? data.height.toLocaleString() : '—'}
            highlight={false}
          />
          <StatCard
            label="Block Diff"
            value={data ? data.blockDiff : '—'}
            unit={data?.blockDiffUnit}
          />
          <StatCard
            label="Pool Hashrate"
            value={data ? data.poolHashrate : '—'}
            unit={data?.poolHashrateUnit}
          />
          <StatCard
            label="Network HR"
            value={data ? data.networkHashrate : '—'}
            unit={data?.networkHashrateUnit}
          />
          <StatCard
            label="Best Share"
            value={data ? data.bestShare : '—'}
            unit={data?.bestShareUnit}
            highlight={true}
          />
          <StatCard
            label="ATH Worker"
            value={data ? data.athShareWorker : '—'}
            unit={data ? `${data.athShare}${data.athShareUnit}` : undefined}
            highlight={true}
          />
        </div>

        {/* Progress block */}
        <div className="mb-4">
          <ProgressBlock
            percent={data?.progressPercent ?? 0}
            etaDays={data?.etaDays ?? 0}
            etaHours={data?.etaHours ?? 0}
            height={data?.height ?? 0}
            lastShareAgo={latestShareAgo === Infinity ? 0 : latestShareAgo}
          />
        </div>

        {/* Workers table */}
        <div className="mb-4">
          <WorkerTable
            workers={data?.workers ?? []}
            athWorkerIds={athWorkerIds}
          />
        </div>

        {/* Alert log */}
        <AlertLog events={alerts} />
      </main>
    </div>
  )
}
