'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './header'
import { ProgressBlock } from './progress-block'
import { AlertLog } from './alert-log'
import { SettingsDrawer } from './settings-drawer'
import { BlockFoundCelebration } from './block-found-celebration'
import type { AlertEvent, NodeStats } from '@/lib/types'
import type { AlertSettings } from '@/app/api/settings/route'

const DEFAULT_POLL_MS = 15000

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  newBest:             true,
  milestones:          true,
  milestoneValues:     [25, 50, 75, 90],
  blockCandidate:      true,
  workerOffline:       true,
  offlineThresholdMin: 10,
}

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
    // Silently fail
  }
}

interface DashboardClientProps {
  initialApiUrl?: string
  initialDiscordUrl?: string
}

// ---- Per-coin panel -------------------------------------------------------

interface CoinPanelState {
  data: NodeStats | null
  error: string | null
}

interface CoinAlertRefs {
  prevBestSinceBlock:    React.MutableRefObject<number>
  netDiffCrossedAlerted: React.MutableRefObject<boolean>
  prevBestShare:         React.MutableRefObject<Record<string, number>>
  offlineAlerted:        React.MutableRefObject<Set<string>>
  milestoneAlerted:      React.MutableRefObject<Set<number>>
  seenOnline:            React.MutableRefObject<Set<string>> // workers seen online since startup
}

function useCoinAlertRefs(): CoinAlertRefs {
  return {
    prevBestSinceBlock:    useRef<number>(0),
    netDiffCrossedAlerted: useRef<boolean>(false),
    prevBestShare:         useRef<Record<string, number>>({}),
    offlineAlerted:        useRef<Set<string>>(new Set()),
    milestoneAlerted:      useRef<Set<number>>(new Set()),
    seenOnline:            useRef<Set<string>>(new Set()),
  }
}

// ---------------------------------------------------------------------------

export function DashboardClient({ initialApiUrl = '', initialDiscordUrl = '' }: DashboardClientProps) {
  const [bchState, setBchState] = useState<CoinPanelState>({ data: null, error: null })
  const [btcState, setBtcState] = useState<CoinPanelState>({ data: null, error: null })
  const [xecState, setXecState] = useState<CoinPanelState>({ data: null, error: null })
  const [alerts, setAlerts]     = useState<AlertEvent[]>([])

  const [bchUrl, setBchUrl]       = useState(initialApiUrl)
  const [btcUrl, setBtcUrl]       = useState('')
  const [xecUrl, setXecUrl]       = useState('')
  const [discordUrl, setDiscordUrl] = useState(initialDiscordUrl)
  const [pollMs, setPollMs]         = useState(DEFAULT_POLL_MS)
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [isRefreshing, setIsRefreshing]     = useState(false)
  const [celebrationCoin, setCelebrationCoin] = useState<'BCH' | 'BTC' | 'XEC' | null>(null)

  // Load persisted settings from server on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s: { apiUrl?: string; btcApiUrl?: string; xecApiUrl?: string; discordUrl?: string; pollMs?: number; alertSettings?: AlertSettings }) => {
        if (s.apiUrl)         setBchUrl(s.apiUrl)
        if (s.btcApiUrl)      setBtcUrl(s.btcApiUrl)
        if (s.xecApiUrl)      setXecUrl(s.xecApiUrl)
        if (s.discordUrl)     setDiscordUrl(s.discordUrl)
        if (s.pollMs)         setPollMs(s.pollMs)
        if (s.alertSettings)  setAlertSettings(s.alertSettings)
        setSettingsLoaded(true)
      })
      .catch(() => setSettingsLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Alert refs per coin
  const bchRefs = useCoinAlertRefs()
  const btcRefs = useCoinAlertRefs()
  const xecRefs = useCoinAlertRefs()

  const addAlert = useCallback((event: Omit<AlertEvent, 'id'>): AlertEvent => {
    const full: AlertEvent = { ...event, id: generateId() }
    setAlerts((prev) => [...prev.slice(-99), full])
    return full
  }, [])

  // ---- Alert engine -------------------------------------------------------
  // Discord alerts for new best, milestones, and block candidates are handled
  // exclusively by the server-side /api/poll route to prevent duplicates.
  // The client only handles worker offline (needs per-worker data) and logs
  // all events locally for the UI alert log.
  function runAlertEngine(
    json: NodeStats,
    coin: 'BCH' | 'BTC' | 'XEC',
    refs: CoinAlertRefs,
    discordWebhookUrl: string,
    as: AlertSettings,
  ) {
    const bsBlockRaw  = json.bestShareSinceBlockRaw ?? 0
    const prevBsBlock = refs.prevBestSinceBlock.current

    // 1. New best share (log only — Discord handled by poll route)
    if (as.newBest && bsBlockRaw > 0 && bsBlockRaw > prevBsBlock && prevBsBlock > 0) {
      const workerName = json.bestShareSinceBlockWorker || 'Unknown'
      addAlert({
        type: 'ath',
        message: `[${coin}] New best by ${workerName}: ${json.bestShareSinceBlock}${json.bestShareSinceBlockUnit} (net diff: ${json.networkDifficulty}${json.networkDifficultyUnit})`,
        workerName,
        timestamp: Date.now(),
        sent: true,
      })
    }
    refs.prevBestSinceBlock.current = bsBlockRaw

    // 2. Block candidate (log only — Discord handled by poll route)
    if (
      as.blockCandidate &&
      bsBlockRaw > 0 &&
      json.networkDifficultyRaw > 0 &&
      bsBlockRaw >= json.networkDifficultyRaw &&
      !refs.netDiffCrossedAlerted.current
    ) {
      refs.netDiffCrossedAlerted.current = true
      const workerName = json.bestShareSinceBlockWorker || 'Unknown'
      addAlert({
        type: 'block_found',
        message: `[${coin}] BLOCK CANDIDATE! ${workerName} share >= network difficulty`,
        workerName,
        timestamp: Date.now(),
        sent: true,
      })
      setCelebrationCoin(coin)
    }
    if (bsBlockRaw < json.networkDifficultyRaw * 0.1) {
      refs.netDiffCrossedAlerted.current = false
    }

    // 3. Worker offline — requires seen-online first, respects threshold setting
    const offlineThresholdS = (as.offlineThresholdMin ?? 10) * 60
    json.workers.forEach((w) => {
      if (w.isOnline) {
        refs.seenOnline.current.add(w.workerId)
        refs.offlineAlerted.current.delete(w.workerId)
      } else if (
        as.workerOffline &&
        w.lastShareAgo >= offlineThresholdS &&
        refs.seenOnline.current.has(w.workerId) &&
        !refs.offlineAlerted.current.has(w.workerId)
      ) {
        refs.offlineAlerted.current.add(w.workerId)
        const alert = addAlert({
          type: 'worker_offline',
          message: `[${coin}] ${w.workerId} offline — no share for ${Math.floor(w.lastShareAgo / 60)}m`,
          workerName: w.workerId,
          timestamp: Date.now(),
          sent: false,
        })
        sendDiscordAlert({
          type: 'worker_offline',
          workerName: w.workerId,
          coin,
          lastShareAgo: w.lastShareAgo,
          discordWebhookUrl,
        }).then(() =>
          setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, sent: true } : a))
        )
      }
    })

    // 4. Milestones (log only — Discord handled by poll route)
    if (as.milestones) {
      as.milestoneValues.forEach((m) => {
        if (json.progressPercent >= m && !refs.milestoneAlerted.current.has(m)) {
          refs.milestoneAlerted.current.add(m)
          addAlert({
            type: 'milestone',
            message: `[${coin}] ${m}% towards block #${json.blockHeight + 1}. ETA: ${json.etaDays}d ${json.etaHours}h`,
            timestamp: Date.now(),
            sent: true,
          })
        }
        if (json.progressPercent < m - 5) refs.milestoneAlerted.current.delete(m)
      })
    }
  }

  // ---- Fetch per coin ------------------------------------------------------
  const fetchCoin = useCallback(async (
    url: string,
    coin: 'BCH' | 'BTC' | 'XEC',
    setState: React.Dispatch<React.SetStateAction<CoinPanelState>>,
    refs: CoinAlertRefs,
    as: AlertSettings,
  ) => {
    if (!url) return
    try {
      const res = await fetch(`/api/mining?url=${encodeURIComponent(url)}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) {
        setState((prev) => ({ ...prev, error: body.error ?? `HTTP ${res.status}` }))
        return
      }
      const json: NodeStats = body
      setState({ data: json, error: null })
      runAlertEngine(json, coin, refs, discordUrl, as)
    } catch (e) {
      setState((prev) => ({ ...prev, error: e instanceof Error ? e.message : 'Fetch failed' }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discordUrl, addAlert])

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    await Promise.all([
      fetchCoin(bchUrl, 'BCH', setBchState, bchRefs, alertSettings),
      fetchCoin(btcUrl, 'BTC', setBtcState, btcRefs, alertSettings),
      fetchCoin(xecUrl, 'XEC', setXecState, xecRefs, alertSettings),
    ])
    if (showSpinner) setIsRefreshing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bchUrl, btcUrl, xecUrl, fetchCoin, alertSettings])

  // Polling
  useEffect(() => {
    if (!settingsLoaded) return
    fetchAll()
    fetch('/api/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertSettings }),
    }).catch(() => {})
    const id = setInterval(() => {
      fetchAll()
      fetch('/api/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertSettings }),
      }).catch(() => {})
    }, pollMs)
    return () => clearInterval(id)
  }, [fetchAll, pollMs, settingsLoaded])

  const isConnected = !!(bchState.data || btcState.data || xecState.data)

  const lastUpdated = bchState.data?.timestamp ?? btcState.data?.timestamp ?? xecState.data?.timestamp ?? null

  return (
    <div className="flex min-h-screen flex-col bg-background font-mono">
      <Header
        isConnected={isConnected}
        lastUpdated={lastUpdated}
        onRefresh={() => fetchAll(true)}
        isRefreshing={isRefreshing}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      <main className="flex-1 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">

        {/* Empty state */}
        {!bchState.data && !btcState.data && !xecState.data && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-card">
              <span className="font-mono text-2xl font-bold text-primary">B</span>
            </div>
            <div className="max-w-sm space-y-2">
              <h2 className="text-base font-semibold text-foreground">Not connected</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Open Settings and enter your AxeBCH, AxeBTC, and/or AxeXEC API URLs.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Open Settings
              </button>
              <button
                onClick={() => fetchAll(true)}
                disabled={isRefreshing}
                className="rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {isRefreshing ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </div>
        )}

        {/* Live data — side by side */}
        {(bchState.data || btcState.data || xecState.data) && (
          <div className="flex flex-col gap-4">

            {/* Coin panels */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">

              {/* BCH Panel */}
              {(bchState.data || bchUrl) && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded" style={{ background: '#0ac18e' }}>
                      <span className="text-xs font-bold text-white">B</span>
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-widest text-foreground">Bitcoin Cash</span>
                    <span className="text-xs text-muted-foreground">BCH</span>
                    {bchState.error && (
                      <span className="ml-auto text-xs text-red-400">Connection error</span>
                    )}
                  </div>
                  {bchState.data ? (
                    <ProgressBlock
                      percent={bchState.data.progressPercent}
                      etaDays={bchState.data.etaDays}
                      etaHours={bchState.data.etaHours}
                      blockHeight={bchState.data.blockHeight}
                      lastShareAgo={bchState.data.lastShareAgo}
                      workerCount={bchState.data.workerCount}
                      hashrateWindows={bchState.data.hashrateWindows}
                      bestShareSinceBlock={bchState.data.bestShareSinceBlock}
                      bestShareSinceBlockUnit={bchState.data.bestShareSinceBlockUnit}
                      bestShareSinceBlockWorker={bchState.data.bestShareSinceBlockWorker}
                      allTimeBest={bchState.data.allTimeBest}
                      allTimeBestUnit={bchState.data.allTimeBestUnit}
                      allTimeBestWorker={bchState.data.allTimeBestWorker}
                      totalHashrate={bchState.data.currentHashrate}
                      totalHashrateUnit={bchState.data.currentHashrateUnit}
                      networkDifficulty={bchState.data.networkDifficulty}
                      networkDifficultyUnit={bchState.data.networkDifficultyUnit}
                      algo={bchState.data.algo}
                      accentColor="#0ac18e"
                      coin="BCH"
                      blockRewardUsd={bchState.data.blockRewardUsd}
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 text-sm text-muted-foreground">
                      {bchState.error ?? 'Connecting...'}
                    </div>
                  )}
                </div>
              )}

              {/* BTC Panel */}
              {(btcState.data || btcUrl) && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-[#f7931a]">
                      <span className="text-xs font-bold text-white">B</span>
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-widest text-foreground">Bitcoin</span>
                    <span className="text-xs text-muted-foreground">BTC</span>
                    {btcState.error && (
                      <span className="ml-auto text-xs text-red-400">Connection error</span>
                    )}
                  </div>
                  {btcState.data ? (
                    <ProgressBlock
                      percent={btcState.data.progressPercent}
                      etaDays={btcState.data.etaDays}
                      etaHours={btcState.data.etaHours}
                      blockHeight={btcState.data.blockHeight}
                      lastShareAgo={btcState.data.lastShareAgo}
                      workerCount={btcState.data.workerCount}
                      hashrateWindows={btcState.data.hashrateWindows}
                      bestShareSinceBlock={btcState.data.bestShareSinceBlock}
                      bestShareSinceBlockUnit={btcState.data.bestShareSinceBlockUnit}
                      bestShareSinceBlockWorker={btcState.data.bestShareSinceBlockWorker}
                      allTimeBest={btcState.data.allTimeBest}
                      allTimeBestUnit={btcState.data.allTimeBestUnit}
                      allTimeBestWorker={btcState.data.allTimeBestWorker}
                      totalHashrate={btcState.data.currentHashrate}
                      totalHashrateUnit={btcState.data.currentHashrateUnit}
                      networkDifficulty={btcState.data.networkDifficulty}
                      networkDifficultyUnit={btcState.data.networkDifficultyUnit}
                      algo={btcState.data.algo}
                      accentColor="#f7931a"
                      coin="BTC"
                      blockRewardUsd={btcState.data.blockRewardUsd}
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 text-sm text-muted-foreground">
                      {btcState.error ?? 'Connecting...'}
                    </div>
                  )}
                </div>
              )}

              {/* XEC Panel */}
              {(xecState.data || xecUrl) && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #7c3aed 100%)' }}>
                      <span className="text-xs font-bold" style={{ color: '#00e5ff' }}>e</span>
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-widest text-foreground">eCash</span>
                    <span className="text-xs text-muted-foreground">XEC</span>
                    {xecState.error && (
                      <span className="ml-auto text-xs text-red-400">Connection error</span>
                    )}
                  </div>
                  {xecState.data ? (
                    <ProgressBlock
                      percent={xecState.data.progressPercent}
                      etaDays={xecState.data.etaDays}
                      etaHours={xecState.data.etaHours}
                      blockHeight={xecState.data.blockHeight}
                      lastShareAgo={xecState.data.lastShareAgo}
                      workerCount={xecState.data.workerCount}
                      hashrateWindows={xecState.data.hashrateWindows}
                      bestShareSinceBlock={xecState.data.bestShareSinceBlock}
                      bestShareSinceBlockUnit={xecState.data.bestShareSinceBlockUnit}
                      bestShareSinceBlockWorker={xecState.data.bestShareSinceBlockWorker}
                      allTimeBest={xecState.data.allTimeBest}
                      allTimeBestUnit={xecState.data.allTimeBestUnit}
                      allTimeBestWorker={xecState.data.allTimeBestWorker}
                      totalHashrate={xecState.data.currentHashrate}
                      totalHashrateUnit={xecState.data.currentHashrateUnit}
                      networkDifficulty={xecState.data.networkDifficulty}
                      networkDifficultyUnit={xecState.data.networkDifficultyUnit}
                      algo={xecState.data.algo}
                      accentColor="#00e5ff"
                      coin="XEC"
                      blockRewardUsd={xecState.data.blockRewardUsd}
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 text-sm text-muted-foreground">
                      {xecState.error ?? 'Connecting...'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Alert log — full width */}
            <AlertLog events={alerts} />
          </div>
        )}
      </main>

      <footer className="border-t border-border px-6 py-4">
        <div className="relative flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Created by MikeyRocks</p>
            <p className="mt-1 text-xs italic text-muted-foreground/60">&ldquo;Its better to have mined and lost than to have never mined at all&rdquo;</p>
          </div>
          <span className="absolute right-0 font-mono text-[10px] text-muted-foreground/40 select-none">v2.20.0</span>
        </div>
      </footer>

      <BlockFoundCelebration
        coin={celebrationCoin}
        onClear={() => setCelebrationCoin(null)}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiUrl={bchUrl}
        btcApiUrl={btcUrl}
        xecApiUrl={xecUrl}
        discordUrl={discordUrl}
        pollMs={pollMs}
        alertSettings={alertSettings}
        onSave={(bch, btc, xec, d, p, as) => {
          setBchUrl(bch)
          setBtcUrl(btc)
          setXecUrl(xec)
          setDiscordUrl(d)
          setPollMs(p)
          setAlertSettings(as)
          setSettingsOpen(false)
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiUrl: bch, btcApiUrl: btc, xecApiUrl: xec, discordUrl: d, pollMs: p, alertSettings: as }),
          }).catch(() => {})
          setTimeout(() => fetchAll(true), 100)
        }}
      />
    </div>
  )
}
