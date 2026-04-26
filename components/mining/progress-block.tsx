'use client'

import { cn } from '@/lib/utils'
import type { HashrateWindow } from '@/lib/types'

interface ProgressBlockProps {
  percent: number
  etaDays: number
  etaHours: number
  blockHeight: number
  lastShareAgo: number   // seconds, across all workers
  workerCount: number
  hashrateWindows: HashrateWindow[]
  // Best share
  bestShareSinceBlock: number
  bestShareSinceBlockUnit: string
  bestShareSinceBlockWorker: string
  allTimeBest: number
  allTimeBestUnit: string
  allTimeBestWorker: string
  // Total hashrate
  totalHashrate: number
  totalHashrateUnit: string
  // Network
  networkDifficulty: number
  networkDifficultyUnit: string
  algo: string
  // Coin accent color — hex string e.g. '#0ac18e' for BCH, '#f7931a' for BTC, '#8b5cf6' for XEC
  accentColor?: string
  coin?: 'BCH' | 'BTC' | 'XEC'
  blockRewardUsd?: number
}

function fmtAgo(s: number): string {
  if (s === 0) return '—'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`
}

export function ProgressBlock({
  percent,
  etaDays,
  etaHours,
  blockHeight,
  lastShareAgo,
  workerCount,
  hashrateWindows,
  bestShareSinceBlock,
  bestShareSinceBlockUnit,
  bestShareSinceBlockWorker,
  allTimeBest,
  allTimeBestUnit,
  allTimeBestWorker,
  totalHashrate,
  totalHashrateUnit,
  networkDifficulty,
  networkDifficultyUnit,
  algo,
  accentColor,
  coin,
  blockRewardUsd,
}: ProgressBlockProps) {
  const clamped  = Math.min(100, Math.max(0, percent))
  const accent   = accentColor ?? 'var(--color-primary)'
  const accentStyle = { color: accent } as React.CSSProperties
  const barStyle    = { width: `${clamped}%`, background: accent } as React.CSSProperties

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 h-full">

      {/* Header row: Workers + Last Share */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-bold" style={accentStyle}>{workerCount}</span>
          <span className="text-base uppercase tracking-widest text-muted-foreground">Online</span>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Last Share</div>
          <div className="font-mono text-xl font-medium text-foreground">{fmtAgo(lastShareAgo)}</div>
        </div>
      </div>

      {/* Main stats grid: Best Share Since Block + If Block Hit */}
      <div className="grid grid-cols-2 gap-3">
        {/* Best Share Since Block */}
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 py-4"
          style={{ borderColor: accent, background: `${accent}10` }}
        >
          <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Best Share Since Block</span>
          <span className="font-mono text-3xl font-bold" style={accentStyle}>
            {bestShareSinceBlock}<span className="ml-1 text-lg font-medium text-muted-foreground">{bestShareSinceBlockUnit}</span>
          </span>
          {bestShareSinceBlockWorker && (
            <span className="text-base text-muted-foreground">by {bestShareSinceBlockWorker}</span>
          )}
        </div>

        {/* If Block Hit */}
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 py-4"
          style={{ borderColor: accent, background: `${accent}10` }}
        >
          <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">If Block Hit</span>
          <span className="font-mono text-3xl font-bold" style={accentStyle}>
            {blockRewardUsd && blockRewardUsd > 0
              ? `$${blockRewardUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : '—'}
          </span>
          <span className="text-base text-muted-foreground">{coin === 'XEC' ? '3.125M' : '3.125'} {coin ?? ''}</span>
        </div>
      </div>

      {/* Network Difficulty + ETA */}
      <div className="grid grid-cols-2 gap-3">
        {/* Network Difficulty */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
          <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Network Difficulty</span>
          <span className="font-mono text-2xl font-semibold text-foreground">
            {networkDifficulty}<span className="ml-1 text-lg text-muted-foreground">{networkDifficultyUnit}</span>
          </span>
          <span className="text-sm text-muted-foreground">{algo} · Height {blockHeight.toLocaleString()}</span>
        </div>

        {/* ETA to Block */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
          <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">ETA to Block</span>
          <span className="font-mono text-2xl font-semibold text-foreground">
            {etaDays > 0 ? `${etaDays}d ` : ''}{etaHours}h
          </span>
          <span className="text-sm text-muted-foreground">based on pool hashrate</span>
        </div>
      </div>

      {/* Total Hashrate + All-Time Best */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
          <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Hashrate</span>
          <span className="font-mono text-3xl font-bold" style={accentStyle}>{totalHashrate}</span>
          <span className="text-base text-muted-foreground">{totalHashrateUnit}</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary/40 py-4">
          <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">All-Time Best</span>
          <span className="font-mono text-3xl font-bold text-foreground">
            {allTimeBest}<span className="ml-1 text-lg font-medium text-muted-foreground">{allTimeBestUnit}</span>
          </span>
          {allTimeBestWorker && (
            <span className="text-base text-muted-foreground">by {allTimeBestWorker}</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-2 mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-base uppercase tracking-widest text-muted-foreground">Progress to Block</span>
          <span
            className="font-mono text-xl font-bold"
            style={clamped >= 75 ? accentStyle : undefined}
          >
            {clamped.toFixed(2)}%
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={barStyle}
          />
          {[25, 50, 75].map((m) => (
            <div
              key={m}
              className="absolute inset-y-0 w-px bg-border/50"
              style={{ left: `${m}%` }}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Highest share difficulty seen — not a guaranteed winning share.
        </p>
      </div>
    </div>
  )
}
