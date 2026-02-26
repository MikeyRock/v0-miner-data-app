'use client'

import { cn } from '@/lib/utils'

interface ProgressBlockProps {
  percent: number
  etaDays: number
  etaHours: number
  height: number
  lastShareAgo: number
}

function formatLastShareAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function ProgressBlock({ percent, etaDays, etaHours, height, lastShareAgo }: ProgressBlockProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent))

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Progress to Block
        </span>
        <span className={cn(
          'font-mono text-sm font-semibold',
          clampedPercent >= 75 ? 'text-primary' : 'text-foreground'
        )}>
          {clampedPercent.toFixed(2)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700"
          style={{ width: `${clampedPercent}%` }}
        />
        {/* Milestone markers */}
        {[25, 50, 75].map((m) => (
          <div
            key={m}
            className="absolute inset-y-0 w-px bg-border/60"
            style={{ left: `${m}%` }}
          />
        ))}
      </div>

      {/* Bottom stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Height</span>
          <span className="font-mono text-sm font-medium">{height.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">ETA</span>
          <span className="font-mono text-sm font-medium">
            {etaDays > 0 ? `${etaDays}d ` : ''}{etaHours}h
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Last Share</span>
          <span className="font-mono text-sm font-medium">{formatLastShareAgo(lastShareAgo)}</span>
        </div>
      </div>
    </div>
  )
}
