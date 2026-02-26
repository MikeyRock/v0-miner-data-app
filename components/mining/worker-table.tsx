'use client'

import { cn } from '@/lib/utils'
import type { Worker } from '@/lib/types'

interface WorkerTableProps {
  workers: Worker[]
  athWorkerIds: Set<string>
}

function formatLastShareAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function WorkerTable({ workers, athWorkerIds }: WorkerTableProps) {
  if (!workers || workers.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-8">
        <span className="text-sm text-muted-foreground">No workers connected</span>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Workers — {workers.length} connected
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Worker
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Hashrate
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Best Share
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Accepted
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Rejected
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Last Share
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker, i) => {
              const isATH = athWorkerIds.has(worker.workerId)
              return (
                <tr
                  key={worker.workerId}
                  className={cn(
                    'border-b border-border/50 transition-colors last:border-0',
                    i % 2 === 0 ? 'bg-card' : 'bg-muted/20',
                    isATH && 'bg-primary/5'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {worker.workerId}
                      </span>
                      {isATH && (
                        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                          ATH
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {worker.hashrate} <span className="text-muted-foreground">{worker.hashrateUnit}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    <span className={cn(isATH && 'text-primary font-semibold')}>
                      {worker.bestShare}
                    </span>
                    <span className="text-muted-foreground"> {worker.bestShareUnit}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                    {worker.sharesAccepted.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    <span className={cn(worker.sharesRejected > 0 && 'text-destructive-foreground')}>
                      {worker.sharesRejected.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                    {formatLastShareAgo(worker.lastShareAgo)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                          worker.isOnline
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            worker.isOnline ? 'bg-green-400' : 'bg-red-400'
                          )}
                        />
                        {worker.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
