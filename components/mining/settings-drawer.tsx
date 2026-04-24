'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Send, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  apiUrl: string
  btcApiUrl: string
  discordUrl: string
  pollMs: number
  onSave: (apiUrl: string, btcApiUrl: string, discordUrl: string, pollMs: number) => void
}

export function SettingsDrawer({ open, onClose, apiUrl, btcApiUrl, discordUrl, pollMs, onSave }: Props) {
  const [localApi, setLocalApi] = useState(apiUrl)
  const [localBtcApi, setLocalBtcApi] = useState(btcApiUrl)
  const [localDiscord, setLocalDiscord] = useState(discordUrl)
  const [localPoll, setLocalPoll] = useState(String(pollMs / 1000))
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    setLocalApi(apiUrl)
    setLocalBtcApi(btcApiUrl)
    setLocalDiscord(discordUrl)
    setLocalPoll(String(pollMs / 1000))
  }, [open, apiUrl, btcApiUrl, discordUrl, pollMs])

  function handleSave() {
    const secs = Math.max(5, parseInt(localPoll, 10) || 15)
    onSave(localApi.trim(), localBtcApi.trim(), localDiscord.trim(), secs * 1000)
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
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

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

          <Field
            label="AxeBCH API URL"
            hint="Direct LAN URL to your AxeBCH node — no proxy needed."
            id="api-url"
          >
            <input
              id="api-url"
              type="url"
              value={localApi}
              onChange={(e) => setLocalApi(e.target.value)}
              placeholder="http://willitmod-dev-bch_app_1:3000/api/pool"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </Field>

          <Field
            label="AxeBTC API URL"
            hint="Direct LAN URL to your AxeBTC node — leave blank to disable BTC panel."
            id="btc-api-url"
          >
            <input
              id="btc-api-url"
              type="url"
              value={localBtcApi}
              onChange={(e) => setLocalBtcApi(e.target.value)}
              placeholder="http://192.168.0.117:21215/api/pool"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </Field>

          <Field
            label="Discord Webhook URL"
            hint="Leave empty to disable Discord notifications."
            id="discord-url"
          >
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
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40
                  hover:border-primary hover:text-primary
                  data-[status=ok]:border-[color:var(--online)] data-[status=ok]:text-[color:var(--online)]
                  data-[status=error]:border-destructive data-[status=error]:text-destructive"
                data-status={testStatus}
              >
                {testStatus === 'sending' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {testStatus === 'ok' && <CheckCircle size={14} />}
                {testStatus === 'error' && <AlertCircle size={14} />}
                {testStatus === 'idle' && <Send size={14} />}
                <span>{testStatus === 'sending' ? 'Sending...' : testStatus === 'ok' ? 'Sent!' : 'Test'}</span>
              </button>
            </div>
            {testStatus === 'error' && testError && (
              <p className="mt-1 text-xs text-destructive">{testError}</p>
            )}
          </Field>

          <Field
            label="Poll Interval (seconds)"
            hint="How often the dashboard refreshes data. Minimum 5s."
            id="poll-interval"
          >
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
            <p><strong className="text-foreground/70">BTC:</strong> use the LAN IP and port of your AxeBTC node (e.g. <code className="text-primary">http://192.168.0.117:21215/api/pool</code>)</p>
            <p className="pt-1">Leave BTC blank to show only the BCH panel. No proxy or .env needed.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save & Reconnect
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
