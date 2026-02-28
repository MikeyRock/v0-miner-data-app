'use client'

import { cn } from '@/lib/utils'
import type { WorkerStats } from '@/lib/types'

interface WorkerTableProps {
  workers: WorkerStats[]
  athWorkerIds: Set<string>
  workerCount?: number
}

function fmtAgo(seconds: number): string {
  if (seconds === 0) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function WorkerTable({ workers, athWorkerIds, workerCount = 0 }: WorkerTableProps) {
  const online  = workers.filter((w) => w.isOnline).length
  const offline = workers.filter((w) => !w.isOnline).length

  // Count-only mode — WillItMod /api/workers does not exist, only a count is available
  if (!workers || workers.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Workers</span>
          <span className="flex items-center gap-1.5 text-sm text-[color:var(--online)]">
            <span className="h-2 w-2 rounded-full bg-[color:var(--online)]" />
            {workerCount} online
          </span>
        </div>
        <div className="p-4">
          {workerCount > 0 ? (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {workerCount} rig{workerCount !== 1 ? 's' : ''} connected. Per-rig names are not available from the WillItMod API — worker names appear below when a new best share is submitted.
              </p>
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: workerCount }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2"
                  >
                    <span className="h-2 w-2 rounded-full bg-[color:var(--online)]" />
                    <span className="font-mono text-sm text-foreground">Rig {i + 1}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No workers connected</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Workers
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-[color:var(--online)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--online)]" />
            {online} online
          </span>
          {offline > 0 && (
            <span className="flex items-center gap-1.5 text-[color:var(--offline)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--offline)]" />
              {offline} offline
            </span>
          )}
        </div>
      </div>

      {/* Worker cards — card layout is cleaner than a table for this data */}
      <div className="divide-y divide-border/50">
        {workers.map((worker) => {
          const isATH = athWorkerIds.has(worker.workerId)
          return (
            <div
              key={worker.workerId}
              className={cn(
                'grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-4',
                isATH && 'bg-primary/5'
              )}
            >
              {/* Name + status */}
              <div className="col-span-2 flex items-center justify-between sm:col-span-4">
                <div className="flex items-center gap-2">
                  {/* Status dot */}
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{
                      background: worker.isOnline
                        ? 'var(--online)'
                        : 'var(--offline)',
                    }}
                  />
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {worker.workerId}
                  </span>
                  {isATH && (
                    <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      ATH
                    </span>
                  )}
                </div>
                {worker.odds ? (
                  <span className="font-mono text-xs text-muted-foreground">{worker.odds}</span>
                ) : null}
              </div>

              {/* Hashrate */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Hashrate</span>
                <span className="font-mono text-sm font-medium text-foreground">
                  {worker.hashrate}
                  <span className="ml-1 text-xs text-muted-foreground">{worker.hashrateUnit}</span>
                </span>
              </div>

              {/* Best share / record */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Record</span>
                <span className={cn(
                  'font-mono text-sm font-medium',
                  isATH ? 'text-primary' : 'text-foreground'
                )}>
                  {worker.bestShare}
                  <span className="ml-1 text-xs text-muted-foreground">{worker.bestShareUnit}</span>
                </span>
              </div>

              {/* Last share */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Last Share</span>
                <span className={cn(
                  'font-mono text-sm font-medium',
                  !worker.isOnline && 'text-[color:var(--offline)]'
                )}>
                  {fmtAgo(worker.lastShareAgo)}
                </span>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</span>
                <span className={cn(
                  'font-mono text-sm font-medium',
                  worker.isOnline ? 'text-[color:var(--online)]' : 'text-[color:var(--offline)]'
                )}>
                  {worker.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
