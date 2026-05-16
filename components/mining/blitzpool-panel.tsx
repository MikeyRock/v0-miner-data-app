'use client'

import Image from 'next/image'
import type { BlitzpoolStats } from '@/app/api/blitzpool/route'

interface BlitzpoolPanelProps {
  data: BlitzpoolStats | null
  error: string | null
}

// Blitzpool blue accent color
const ACCENT = '#3B82F6'

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e18) return `${(hashrate / 1e18).toFixed(2)} EH/s`
  if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`
  if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} KH/s`
  return `${hashrate.toFixed(2)} H/s`
}

function formatDifficulty(diff: number): { num: string; unit: string } {
  if (diff >= 1e12) return { num: (diff / 1e12).toFixed(2), unit: 'T' }
  if (diff >= 1e9) return { num: (diff / 1e9).toFixed(2), unit: 'G' }
  if (diff >= 1e6) return { num: (diff / 1e6).toFixed(2), unit: 'M' }
  if (diff >= 1e3) return { num: (diff / 1e3).toFixed(2), unit: 'K' }
  return { num: diff.toFixed(2), unit: '' }
}

function formatShares(shares: number): string {
  if (shares >= 1e9) return `${(shares / 1e9).toFixed(2)}B`
  if (shares >= 1e6) return `${(shares / 1e6).toFixed(2)}M`
  if (shares >= 1e3) return `${(shares / 1e3).toFixed(2)}K`
  return shares.toFixed(0)
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const accentStyle = { color: ACCENT }

export function BlitzpoolPanel({ data, error }: BlitzpoolPanelProps) {
  const LogoHeader = () => (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded overflow-hidden">
        <Image
          src="/blitzpool-logo.png"
          alt="Blitzpool"
          width={32}
          height={32}
          className="object-contain"
        />
      </div>
      <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Blitzpool</span>
      <span className="ml-1 text-xs text-muted-foreground">Solo BTC</span>
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

  const bestDiff = formatDifficulty(data.bestDifficulty)
  const networkDiff = formatDifficulty(data.networkDifficulty)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <LogoHeader />

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4">
        {/* Workers Online + Last Share */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold" style={accentStyle}>{data.workersCount}</span>
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Online</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground block">Total Hashrate</span>
            <span className="font-mono text-lg font-semibold" style={accentStyle}>{formatHashrate(data.totalHashrate)}</span>
          </div>
        </div>

        {/* Best Difficulty Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 py-4"
            style={{ borderColor: ACCENT, background: `${ACCENT}10` }}
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Best Difficulty</span>
            <span className="font-mono text-3xl font-bold" style={accentStyle}>
              {bestDiff.num}<span className="ml-1 text-lg font-medium text-muted-foreground">{bestDiff.unit}</span>
            </span>
            <span className="text-[10px] text-muted-foreground mt-1">{data.progressPercent.toFixed(4)}% of network</span>
          </div>
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 py-4"
            style={{ borderColor: ACCENT, background: `${ACCENT}10` }}
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Network Diff</span>
            <span className="font-mono text-3xl font-bold" style={accentStyle}>
              {networkDiff.num}<span className="ml-1 text-lg font-medium text-muted-foreground">{networkDiff.unit}</span>
            </span>
            <span className="text-[10px] text-muted-foreground mt-1">Height {data.blockHeight.toLocaleString()}</span>
          </div>
        </div>

        {/* Total Shares */}
        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Shares</span>
            <span className="font-mono text-2xl font-semibold text-foreground">{formatShares(data.totalShares)}</span>
          </div>
        </div>

        {/* Progress to Block */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Progress to Block</span>
          <span className="font-mono text-lg font-bold" style={accentStyle}>{data.progressPercent.toFixed(2)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden -mt-2">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(data.progressPercent, 100)}%`, backgroundColor: ACCENT }} />
        </div>

        {/* Workers list */}
        {data.workers.length > 0 && (
          <div className="border-t border-border/40 pt-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Workers</span>
            <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 #000' }}>
              {data.workers.map((w) => (
                <div key={w.sessionId} className="flex items-center justify-between text-[11px] px-1 py-0.5">
                  <span className="text-foreground font-medium truncate flex-1">{w.name}</span>
                  <span className="text-muted-foreground mx-2">{formatHashrate(w.hashRate)}</span>
                  <span className="text-muted-foreground">{timeAgo(w.lastSeen)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] leading-snug text-muted-foreground/70 text-center">
          Solo mining on Blitzpool — not a guaranteed winning share.
        </p>
      </div>
    </div>
  )
}
