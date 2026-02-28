'use client'

import { useState, useEffect } from 'react'
import { X, Settings } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  apiUrl: string
  discordUrl: string
  pollMs: number
  onSave: (apiUrl: string, discordUrl: string, pollMs: number) => void
}

export function SettingsDrawer({ open, onClose, apiUrl, discordUrl, pollMs, onSave }: Props) {
  const [localApi, setLocalApi] = useState(apiUrl)
  const [localDiscord, setLocalDiscord] = useState(discordUrl)
  const [localPoll, setLocalPoll] = useState(String(pollMs / 1000))

  useEffect(() => {
    setLocalApi(apiUrl)
    setLocalDiscord(discordUrl)
    setLocalPoll(String(pollMs / 1000))
  }, [open, apiUrl, discordUrl, pollMs])

  function handleSave() {
    const secs = Math.max(5, parseInt(localPoll, 10) || 15)
    onSave(localApi.trim(), localDiscord.trim(), secs * 1000)
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
            label="Discord Webhook URL"
            hint="Leave empty to disable Discord notifications."
            id="discord-url"
          >
            <input
              id="discord-url"
              type="url"
              value={localDiscord}
              onChange={(e) => setLocalDiscord(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
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
            <p>If you have the <strong className="text-foreground/70">WillItMod AxeBCH</strong> app installed, use:</p>
            <p><code className="text-primary select-all">http://willitmod-dev-bch_app_1:3000/api/pool</code></p>
            <p className="pt-1">No proxy, no .env file needed — just paste the URL above and hit Save.</p>
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
