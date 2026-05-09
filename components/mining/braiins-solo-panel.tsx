'use client'

import Image from 'next/image'
import type { BraiinsSoloStats } from '@/app/api/braiins-solo/route'

interface BraiinsSoloPanelProps {
  data: BraiinsSoloStats | null
  error: string | null
}

// Braiins purple accent color
const ACCENT = '#9b59b6'

function fmtAgo(ts: number): string {
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatBestShare(value: number): { num: string; unit: string } {
  if (value >= 1e12) return { num: (value / 1e12).toFixed(2), unit: 'T' }
  if (value >= 1e9) return { num: (value / 1e9).toFixed(2), unit: 'G' }
  if (value >= 1e6) return { num: (value / 1e6).toFixed(2), unit: 'M' }
  if (value >= 1e3) return { num: (value / 1e3).toFixed(2), unit: 'K' }
  return { num: value.toFixed(2), unit: '' }
}

export function BraiinsSoloPanel({ data, error }: BraiinsSoloPanelProps) {
  const accentStyle = { color: ACCENT }

  const LogoHeader = () => (
    <div className="flex items-center gap-2">
      <div className="flex h-7 items-center justify-center rounded bg-black px-2">
        <Image
          src="/braiins-logo.jpg"
          alt="Braiins"
          width={70}
          height={20}
          className="object-contain"
        />
      </div>
      <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Solo</span>
      <span className="ml-1 text-xs text-muted-foreground">BTC</span>
    </div>
  )

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <LogoHeader />
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <LogoHeader />
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 animate-pulse">
          <div className="h-8 w-24 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const bestShare = formatBestShare(data.bestshare)
  const bestEver = formatBestShare(data.bestever)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <LogoHeader />

      {/* Panel */}
      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 h-full">
        {/* Header row: Workers + Last Share */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold" style={accentStyle}>{data.workers}</span>
            <span className="text-base uppercase tracking-widest text-muted-foreground">Online</span>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Last Share</div>
            <div className="font-mono text-xl font-medium text-foreground">{fmtAgo(data.lastshare)}</div>
          </div>
        </div>

        {/* Best Share Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 py-4"
            style={{ borderColor: ACCENT, background: `${ACCENT}10` }}
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Best Share</span>
            <span className="font-mono text-3xl font-bold" style={accentStyle}>
              {bestShare.num}<span className="ml-1 text-lg font-medium text-muted-foreground">{bestShare.unit}</span>
            </span>
          </div>
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 py-4"
            style={{ borderColor: ACCENT, background: `${ACCENT}10` }}
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Best Ever</span>
            <span className="font-mono text-3xl font-bold" style={accentStyle}>
              {bestEver.num}<span className="ml-1 text-lg font-medium text-muted-foreground">{bestEver.unit}</span>
            </span>
          </div>
        </div>

        {/* Shares Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Shares</span>
            <span className="font-mono text-2xl font-semibold text-foreground">
              {data.shares.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Rejected</span>
            <span className="font-mono text-2xl font-semibold text-foreground">
              {data.rejected}
            </span>
          </div>
        </div>

        {/* Hashrate Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Hashrate (5m)</span>
            <span className="font-mono text-3xl font-bold" style={accentStyle}>{data.hashrate5m}</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Hashrate (1hr)</span>
            <span className="font-mono text-3xl font-bold" style={accentStyle}>{data.hashrate1hr}</span>
          </div>
        </div>

        {/* Workers List */}
        {data.worker && data.worker.length > 0 && (
          <div className="flex flex-col gap-2 mt-auto">
            <span className="text-sm uppercase tracking-widest text-muted-foreground">Workers</span>
            <div className="flex flex-col gap-1">
              {data.worker.map((w) => (
                <div key={w.workername} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
                  <span className="text-sm text-foreground font-mono truncate max-w-[200px]">
                    {w.workername.split('.').pop() || w.workername}
                  </span>
                  <span className="text-sm font-mono" style={accentStyle}>{w.hashrate5m}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
