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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">

      {/* Top row: worker count + last share */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-mono text-foreground">
            <span className="text-2xl font-bold" style={accentStyle}>{workerCount}</span>
            <span className="ml-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">Online</span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-0">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Last Share</span>
          <span className="font-mono text-sm font-medium text-foreground">
            {fmtAgo(lastShareAgo)}
          </span>
          <span className="text-[9px] text-muted-foreground">across all workers</span>
        </div>
      </div>

      {/* Two rows: hashrate windows on top, Total + If Block Hit below */}
      {hashrateWindows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {/* Row 1: window chips — flex wrap allowed */}
          <div className="flex flex-wrap gap-1">
            {hashrateWindows.map((w) => (
              <div
                key={w.label}
                className="flex flex-col items-center rounded border border-border bg-secondary px-1.5 py-0.5 min-w-[40px]"
              >
                <span className="text-[8px] uppercase tracking-wide text-muted-foreground">{w.label}</span>
                <span className="font-mono text-xs font-semibold text-foreground leading-tight">{w.value}</span>
                <span className="text-[8px] text-muted-foreground">{w.unit}</span>
              </div>
            ))}
          </div>
          {/* Row 2: Total + If Block Hit */}
          <div className="flex gap-1">
            {totalHashrate > 0 && (
              <div
                className="flex flex-col items-center rounded border px-1.5 py-0.5 min-w-[50px]"
                style={{ borderColor: accent, background: `${accent}18` }}
              >
                <span className="text-[8px] uppercase tracking-wide" style={accentStyle}>Total</span>
                <span className="font-mono text-xs font-bold leading-tight" style={accentStyle}>{totalHashrate}</span>
                <span className="text-[8px] text-muted-foreground">{totalHashrateUnit}</span>
              </div>
            )}
            <div
              className="flex flex-col items-center rounded border px-1.5 py-0.5 min-w-[60px]"
              style={{ borderColor: accent, background: `${accent}18` }}
            >
              <span className="text-[8px] uppercase tracking-wide" style={accentStyle}>If Block Hit</span>
              <span className="font-mono text-xs font-bold leading-tight" style={accentStyle}>
                {blockRewardUsd && blockRewardUsd > 0
                  ? `$${blockRewardUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                  : '—'}
              </span>
              <span className="text-[8px] text-muted-foreground">{coin === 'XEC' ? '3.125M' : '3.125'} {coin ?? ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Network difficulty + height */}
      <div className="flex items-center justify-between rounded bg-secondary px-2 py-1.5">
        <div className="flex flex-col gap-0">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Network Difficulty</span>
          <span className="font-mono text-base font-semibold text-foreground">
            {networkDifficulty}<span className="ml-0.5 text-xs text-muted-foreground">{networkDifficultyUnit}</span>
          </span>
          <span className="text-[9px] text-muted-foreground">{algo} · Height {blockHeight.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-end gap-0">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">ETA to Block</span>
          <span className="font-mono text-base font-semibold text-foreground">
            {etaDays > 0 ? `${etaDays}d ` : ''}{etaHours}h
          </span>
          <span className="text-[9px] text-muted-foreground">based on pool hashrate</span>
        </div>
      </div>

      {/* Best share cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded border border-border bg-secondary px-2 py-1.5">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Best Share Since Block</span>
          <span className="font-mono text-lg font-bold" style={accentStyle}>
            {bestShareSinceBlock}<span className="ml-0.5 text-xs font-medium text-muted-foreground">{bestShareSinceBlockUnit}</span>
          </span>
          {bestShareSinceBlockWorker && (
            <span className="text-[10px] text-muted-foreground">by {bestShareSinceBlockWorker}</span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 rounded border border-border bg-secondary px-2 py-1.5">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">All-Time Best</span>
          <span className="font-mono text-lg font-bold text-foreground">
            {allTimeBest}<span className="ml-0.5 text-xs font-medium text-muted-foreground">{allTimeBestUnit}</span>
          </span>
          {allTimeBestWorker && (
            <span className="text-[10px] text-muted-foreground">by {allTimeBestWorker}</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Progress to Block</span>
          <span
            className="font-mono text-sm font-bold"
            style={clamped >= 75 ? accentStyle : undefined}
          >
            {clamped.toFixed(2)}%
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={barStyle}
          />
          {[25, 50, 75].map((m) => (
            <div
              key={m}
              className="absolute inset-y-0 w-px bg-border"
              style={{ left: `${m}%` }}
            />
          ))}
        </div>
        <p className="text-[8px] text-muted-foreground">
          Highest share difficulty seen — not a guaranteed winning share.
        </p>
      </div>
    </div>
  )
}
