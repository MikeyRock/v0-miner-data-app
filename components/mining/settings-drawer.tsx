'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Send, CheckCircle, AlertCircle } from 'lucide-react'
import type { AlertSettings } from '@/app/api/settings/route'

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  newBest:             true,
  milestones:          true,
  milestoneValues:     [25, 50, 75, 90],
  blockCandidate:      true,
  workerOffline:       true,
  offlineThresholdMin: 10,
}

const ALL_MILESTONES = [10, 25, 50, 75, 90, 95]

interface Props {
  open: boolean
  onClose: () => void
  apiUrl: string
  btcApiUrl: string
  discordUrl: string
  pollMs: number
  alertSettings: AlertSettings
  onSave: (apiUrl: string, btcApiUrl: string, discordUrl: string, pollMs: number, alertSettings: AlertSettings) => void
}

export function SettingsDrawer({ open, onClose, apiUrl, btcApiUrl, discordUrl, pollMs, alertSettings, onSave }: Props) {
  const [tab, setTab] = useState<'connection' | 'alerts'>('connection')

  // Connection tab state
  const [localApi, setLocalApi]         = useState(apiUrl)
  const [localBtcApi, setLocalBtcApi]   = useState(btcApiUrl)
  const [localDiscord, setLocalDiscord] = useState(discordUrl)
  const [localPoll, setLocalPoll]       = useState(String(pollMs / 1000))
  const [testStatus, setTestStatus]     = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [testError, setTestError]       = useState('')

  // Alert settings tab state
  const [localAlerts, setLocalAlerts] = useState<AlertSettings>(alertSettings ?? DEFAULT_ALERT_SETTINGS)

  useEffect(() => {
    setLocalApi(apiUrl)
    setLocalBtcApi(btcApiUrl)
    setLocalDiscord(discordUrl)
    setLocalPoll(String(pollMs / 1000))
    setLocalAlerts(alertSettings ?? DEFAULT_ALERT_SETTINGS)
    setTab('connection')
  }, [open, apiUrl, btcApiUrl, discordUrl, pollMs, alertSettings])

  function handleSave() {
    const secs = Math.max(5, parseInt(localPoll, 10) || 15)
    onSave(localApi.trim(), localBtcApi.trim(), localDiscord.trim(), secs * 1000, localAlerts)
  }

  function toggleMilestone(m: number) {
    setLocalAlerts((prev) => {
      const has = prev.milestoneValues.includes(m)
      return {
        ...prev,
        milestoneValues: has
          ? prev.milestoneValues.filter((x) => x !== m)
          : [...prev.milestoneValues, m].sort((a, b) => a - b),
      }
    })
  }

  async function handleTestDiscord() {
    if (!localDiscord.trim()) return
    setTestStatus('sending')
    setTestError('')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'milestone',
          progressPercent: 0,
          etaDays: 0,
          etaHours: 0,
          discordWebhookUrl: localDiscord.trim(),
          _test: true,
        }),
      })
      const body = await res.json()
      if (res.ok) {
        setTestStatus('ok')
        setTimeout(() => setTestStatus('idle'), 3000)
      } else {
        setTestStatus('error')
        setTestError(body.error ?? `HTTP ${res.status}`)
      }
    } catch (e) {
      setTestStatus('error')
      setTestError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="fixed right-0 top-0 z-50 h-full w-full max-w-sm border-l border-border bg-card shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-foreground">
            <Settings size={16} className="text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['connection', 'alerts'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors
                ${tab === t
                  ? 'text-primary border-b-2 border-primary bg-muted/30'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {t === 'connection' ? 'Connection' : 'Alerts'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

          {tab === 'connection' && (
            <>
              <Field label="AxeBCH API URL" hint="Direct LAN URL to your AxeBCH node — no proxy needed." id="api-url">
                <input
                  id="api-url"
                  type="url"
                  value={localApi}
                  onChange={(e) => setLocalApi(e.target.value)}
                  placeholder="http://willitmod-dev-bch_app_1:3000/api/pool"
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </Field>

              <Field label="AxeBTC API URL" hint="Direct LAN URL to your AxeBTC node — leave blank to disable BTC panel." id="btc-api-url">
                <input
                  id="btc-api-url"
                  type="url"
                  value={localBtcApi}
                  onChange={(e) => setLocalBtcApi(e.target.value)}
                  placeholder="http://willitmod-btc_app_1:3000/api/pool"
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </Field>

              <Field label="Discord Webhook URL" hint="Leave empty to disable Discord notifications." id="discord-url">
                <div className="flex gap-2">
                  <input
                    id="discord-url"
                    type="url"
                    value={localDiscord}
                    onChange={(e) => { setLocalDiscord(e.target.value); setTestStatus('idle') }}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  <button
                    onClick={handleTestDiscord}
                    disabled={!localDiscord.trim() || testStatus === 'sending'}
                    title="Send a test alert to Discord"
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 hover:border-primary hover:text-primary"
                  >
                    {testStatus === 'sending' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                    {testStatus === 'ok' && <CheckCircle size={14} className="text-[color:var(--online)]" />}
                    {testStatus === 'error' && <AlertCircle size={14} className="text-destructive" />}
                    {testStatus === 'idle' && <Send size={14} />}
                    <span>{testStatus === 'sending' ? 'Sending...' : testStatus === 'ok' ? 'Sent!' : 'Test'}</span>
                  </button>
                </div>
                {testStatus === 'error' && testError && (
                  <p className="mt-1 text-xs text-destructive">{testError}</p>
                )}
              </Field>

              <Field label="Poll Interval (seconds)" hint="How often the dashboard refreshes. Minimum 5s." id="poll-interval">
                <input
                  id="poll-interval"
                  type="number"
                  min={5}
                  max={300}
                  value={localPoll}
                  onChange={(e) => setLocalPoll(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </Field>

              <div className="rounded-md border border-border/50 bg-muted/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="font-semibold text-foreground/60 uppercase tracking-wider text-[10px]">On Umbrel</p>
                <p><strong className="text-foreground/70">BCH:</strong> <code className="text-primary select-all">http://willitmod-dev-bch_app_1:3000/api/pool</code></p>
                <p><strong className="text-foreground/70">BTC:</strong> <code className="text-primary">http://willitmod-btc_app_1:3000/api/pool</code></p>
                <p className="pt-1">Leave BTC blank to show only the BCH panel.</p>
              </div>
            </>
          )}

          {tab === 'alerts' && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discord Alert Types</p>
                <p className="text-xs text-muted-foreground/60">Toggle which events send a Discord notification. All events still appear in the on-screen alert log.</p>
              </div>

              <div className="space-y-3">
                <Toggle
                  label="New Best Share"
                  description="When a worker sets a new best share for the current block."
                  checked={localAlerts.newBest}
                  onChange={(v) => setLocalAlerts((p) => ({ ...p, newBest: v }))}
                />
                <Toggle
                  label="Block Candidate"
                  description="When a share meets or exceeds network difficulty."
                  checked={localAlerts.blockCandidate}
                  onChange={(v) => setLocalAlerts((p) => ({ ...p, blockCandidate: v }))}
                />
                <Toggle
                  label="Worker Offline"
                  description="When a worker that was active goes silent."
                  checked={localAlerts.workerOffline}
                  onChange={(v) => setLocalAlerts((p) => ({ ...p, workerOffline: v }))}
                />
              </div>

              {localAlerts.workerOffline && (
                <Field label="Offline Threshold (minutes)" hint="How long a worker must be silent before an offline alert fires." id="offline-threshold">
                  <input
                    id="offline-threshold"
                    type="number"
                    min={1}
                    max={120}
                    value={localAlerts.offlineThresholdMin}
                    onChange={(e) => setLocalAlerts((p) => ({ ...p, offlineThresholdMin: Math.max(1, parseInt(e.target.value, 10) || 10) }))}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </Field>
              )}

              <div className="space-y-3">
                <Toggle
                  label="Progress Milestones"
                  description="When pool progress crosses the selected thresholds."
                  checked={localAlerts.milestones}
                  onChange={(v) => setLocalAlerts((p) => ({ ...p, milestones: v }))}
                />
              </div>

              {localAlerts.milestones && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Milestone Thresholds</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_MILESTONES.map((m) => {
                      const active = localAlerts.milestoneValues.includes(m)
                      return (
                        <button
                          key={m}
                          onClick={() => toggleMilestone(m)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-mono font-semibold transition-colors
                            ${active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                            }`}
                        >
                          {m}%
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground/60">Tap to toggle. Orange = active.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save & Apply
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      </aside>
    </>
  )
}

function Field({ label, hint, id, children }: { label: string; hint: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      <p className="text-xs text-muted-foreground/70">{hint}</p>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-secondary/30 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors
          ${checked ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
        <span className="sr-only">{checked ? 'Enabled' : 'Disabled'}</span>
      </button>
    </div>
  )
}
