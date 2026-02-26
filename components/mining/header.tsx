'use client'

import { cn } from '@/lib/utils'

interface HeaderProps {
  isConnected: boolean
  lastUpdated: number | null
  onRefresh: () => void
  isRefreshing: boolean
}

export function Header({ isConnected, lastUpdated, onRefresh, isRefreshing }: HeaderProps) {
  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        {/* Bitcoin B logo */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
          B
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">AxeBCH Mining Dashboard</span>
          <span className="text-xs text-muted-foreground">Solo Node Monitor</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-400' : 'bg-red-400'
            )}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {lastUpdated && (
          <span className="hidden text-xs text-muted-foreground sm:block">
            Updated {formatTime(lastUpdated)}
          </span>
        )}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            'rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground',
            'transition-all hover:border-primary/50 hover:text-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isRefreshing && 'animate-pulse'
          )}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </header>
  )
}
