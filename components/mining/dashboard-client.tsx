'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './header'
import { StatCard } from './stat-card'
import { ProgressBlock } from './progress-block'
import { WorkerTable } from './worker-table'
import { AlertLog } from './alert-log'
import { SettingsDrawer } from './settings-drawer'
import type { AlertEvent, NodeStats } from '@/lib/types'

const DEFAULT_POLL_MS = 15000
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
  const [apiUrl, setApiUrl] = useState('http://192.168.0.117:21212/api/node')
  const [discordUrl, setDiscordUrl] = useState('')
  const [pollMs, setPollMs] = useState(DEFAULT_POLL_MS)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
      const params = new URLSearchParams({ url: apiUrl })
      const res = await fetch(`/api/mining?${params}`, { cache: 'no-store' })
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
            message: `${w.workerId} hit a new best share: ${w.bestShare}${w.bestShareUnit} (block diff: ${json.blockDiff}${json.blockDiffUnit})`,
            workerName: w.workerId,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({
            type: 'ath',
            workerName: w.workerId,
            bestShare: `${w.bestShare}${w.bestShareUnit}`,
            blockDiff: `${json.blockDiff}${json.blockDiffUnit}`,
            discordWebhookUrl: discordUrl,
          }).then(() =>
            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a)))
          )
        }
        prevBestShareRef.current[w.workerId] = w.bestShareRaw
      })

      // 2. Worker offline
      json.workers.forEach((w) => {
        if (!w.isOnline && !offlineAlertedRef.current.has(w.workerId)) {
          offlineAlertedRef.current.add(w.workerId)
          const alert = addAlert({
            type: 'worker_offline',
            message: `Worker ${w.workerId} offline — no share for ${Math.floor(w.lastShareAgo / 60)}m`,
            workerName: w.workerId,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({
            type: 'worker_offline',
            workerName: w.workerId,
            lastShareAgo: w.lastShareAgo,
            discordWebhookUrl: discordUrl,
          }).then(() =>
            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a)))
          )
        }
        if (w.isOnline) offlineAlertedRef.current.delete(w.workerId)
      })

      // 3. Progress milestones
      MILESTONES.forEach((m) => {
        if (json.progressPercent >= m && !milestoneAlertedRef.current.has(m)) {
          milestoneAlertedRef.current.add(m)
          const alert = addAlert({
            type: 'milestone',
            message: `Progress milestone: ${m}% towards block #${json.height + 1}. ETA: ${json.etaDays}d ${json.etaHours}h`,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({
            type: 'milestone',
            progressPercent: m,
            etaDays: json.etaDays,
            etaHours: json.etaHours,
            discordWebhookUrl: discordUrl,
          }).then(() =>
            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a)))
          )
        }
        if (json.progressPercent < m - 5) milestoneAlertedRef.current.delete(m)
      })

      // 4. Block found — progress resets near 0
      if (json.progressPercent < 1 && json.height > 0 && !blockFoundAlertedRef.current.has(json.height)) {
        blockFoundAlertedRef.current.add(json.height)
        if (blockFoundAlertedRef.current.size > 1) {
          const alert = addAlert({
            type: 'block_found',
            message: `Block #${json.height} found! The pool solved a block.`,
            timestamp: Date.now(),
            sent: false,
          })
          sendDiscordAlert({
            type: 'block_found',
            height: json.height,
            discordWebhookUrl: discordUrl,
          }).then(() =>
            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, sent: true } : a)))
          )
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      if (showSpinner) setIsRefreshing(false)
    }
  }, [addAlert, apiUrl, discordUrl])

  // Initial fetch + polling
  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), pollMs)
    return () => clearInterval(interval)
  }, [fetchData, pollMs])

  const isConnected = !!data && !error
  const athWorkerIds = new Set(
    data?.workers
      .filter((w) => w.bestShareRaw === (data?.bestShareRaw ?? 0) && w.bestShareRaw > 0)
      .map((w) => w.workerId) ?? []
  )
  const latestShareAgo =
    data?.workers
      .filter((w) => w.isOnline)
      .reduce((min, w) => Math.min(min, w.lastShareAgo), Infinity) ?? 0

  return (
    <div className="flex min-h-screen flex-col bg-background font-mono">
      <Header
        isConnected={isConnected}
        lastUpdated={data?.timestamp ?? null}
        onRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      <main className="flex-1 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">

        {/* Not connected — show empty state until real data arrives */}
        {!data && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="font-mono text-2xl font-bold text-primary">B</span>
            </div>
            <div className="space-y-2 max-w-sm">
              <h2 className="text-base font-semibold text-foreground">
                {error ? 'Cannot reach your node' : 'Waiting for connection...'}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {error
                  ? error
                  : 'Open Settings and enter your AxeBCH API URL. The dashboard will populate once a live connection is established.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Open Settings
              </button>
              {error && (
                <button
                  onClick={() => fetchData(true)}
                  disabled={isRefreshing}
                  className="rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isRefreshing ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live data — only rendered when real data is present */}
        {data && (
          <>
            {/* Connection error banner (has stale data but fetch just failed) */}
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-red-400">
                Connection error: {error} — showing last known data.
              </div>
            )}

            {/* Top stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
              <StatCard label="Block Height" value={data.height.toLocaleString()} />
              <StatCard label="Block Diff" value={String(data.blockDiff)} unit={data.blockDiffUnit} />
              <StatCard label="Pool Hashrate" value={String(data.poolHashrate)} unit={data.poolHashrateUnit} />
              <StatCard label="Network HR" value={String(data.networkHashrate)} unit={data.networkHashrateUnit} />
              <StatCard label="Best Share" value={String(data.bestShare)} unit={data.bestShareUnit} highlight />
              <StatCard label="ATH Worker" value={data.athShareWorker || '—'} unit={`${data.athShare}${data.athShareUnit}`} highlight />
            </div>

            {/* Progress block */}
            <div className="mb-4">
              <ProgressBlock
                percent={data.progressPercent}
                etaDays={data.etaDays}
                etaHours={data.etaHours}
                height={data.height}
                lastShareAgo={latestShareAgo === Infinity ? 0 : latestShareAgo}
              />
            </div>

            {/* Workers + alerts side by side on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <WorkerTable workers={data.workers} athWorkerIds={athWorkerIds} />
              </div>
              <div>
                <AlertLog events={alerts} />
              </div>
            </div>
          </>
        )}
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiUrl={apiUrl}
        discordUrl={discordUrl}
        pollMs={pollMs}
        onSave={(a, d, p) => {
          setApiUrl(a)
          setDiscordUrl(d)
          setPollMs(p)
          setSettingsOpen(false)
          setTimeout(() => fetchData(true), 100)
        }}
      />
    </div>
  )
}
