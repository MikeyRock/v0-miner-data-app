'use client'

import { cn } from '@/lib/utils'
import type { AlertEvent } from '@/lib/types'

interface AlertLogProps {
  events: AlertEvent[]
}

const TYPE_CONFIG = {
  block_found: { label: 'Block Found', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  ath: { label: 'New ATH', color: 'text-primary bg-primary/10 border-primary/30' },
  worker_offline: { label: 'Offline', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  milestone: { label: 'Milestone', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function AlertLog({ events }: AlertLogProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Alert Log
        </span>
      </div>
      <div 
        className="flex flex-col gap-0 overflow-y-auto"
        style={{ maxHeight: 'calc(3 * 52px)' }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            width: 8px;
          }
          div::-webkit-scrollbar-track {
            background: #000;
          }
          div::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 4px;
          }
          div::-webkit-scrollbar-thumb:hover {
            background: #444;
          }
        `}</style>
        {events.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            <span className="text-xs text-muted-foreground">No alerts yet this session</span>
          </div>
        ) : (
          events.slice().reverse().map((event) => {
            const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.milestone
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 border-b border-border/40 px-4 py-2.5 last:border-0"
              >
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium',
                    config.color
                  )}
                >
                  {config.label}
                </span>
                <span className="flex-1 text-xs text-foreground leading-relaxed">{event.message}</span>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-xs text-muted-foreground">{timeAgo(event.timestamp)}</span>
                  {event.sent && (
                    <span className="text-xs text-green-400">Discord sent</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
