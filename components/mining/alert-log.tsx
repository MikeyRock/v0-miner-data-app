'use client'

import { cn } from '@/lib/utils'

export interface AlertEvent {
  id: string
  type: 'worker_offline' | 'worker_online' | 'block_found' | 'milestone' | 'best_share'
  message: string
  timestamp: number
  sent?: boolean
}

export interface AlertLogProps {
  events: AlertEvent[]
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  worker_offline: { label: 'Offline', color: 'border-red-500/60 bg-red-500/10 text-red-400' },
  worker_online: { label: 'Online', color: 'border-green-500/60 bg-green-500/10 text-green-400' },
  block_found: { label: 'Block!', color: 'border-yellow-500/60 bg-yellow-500/10 text-yellow-400' },
  milestone: { label: 'Milestone', color: 'border-orange-500/60 bg-orange-500/10 text-orange-400' },
  best_share: { label: 'Best Share', color: 'border-blue-500/60 bg-blue-500/10 text-blue-400' },
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
      <div className="border-b border-border px-2 py-1">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Alert Log
        </span>
      </div>
      <div 
        className="flex flex-col gap-0 overflow-y-auto"
        style={{ maxHeight: 'calc(3 * 22px)' }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            width: 6px;
          }
          div::-webkit-scrollbar-track {
            background: #000;
          }
          div::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 3px;
          }
          div::-webkit-scrollbar-thumb:hover {
            background: #444;
          }
        `}</style>
        {events.length === 0 ? (
          <div className="flex items-center justify-center py-2">
            <span className="text-[10px] text-muted-foreground">No alerts yet this session</span>
          </div>
        ) : (
          events.slice().reverse().map((event) => {
            const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.milestone
            return (
              <div
                key={event.id}
                className="flex items-center gap-1.5 border-b border-border/40 px-2 py-0.5 last:border-0"
              >
                <span
                  className={cn(
                    'shrink-0 rounded border px-1 py-px text-[9px] font-medium leading-tight',
                    config.color
                  )}
                >
                  {config.label}
                </span>
                <span className="flex-1 text-[10px] text-foreground truncate">{event.message}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground">{timeAgo(event.timestamp)}</span>
                  {event.sent && (
                    <span className="text-[9px] text-green-400">Sent</span>
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
