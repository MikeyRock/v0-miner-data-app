'use client'

import { RefreshCw, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  isConnected: boolean
  lastUpdated: number | null
  onRefresh: () => void
  isRefreshing: boolean
  onSettingsOpen: () => void
}

function formatTimeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

export function Header({ isConnected, lastUpdated, onRefresh, isRefreshing, onSettingsOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 px-4 py-3 md:px-6">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md font-mono text-base font-bold select-none" style={{ background: '#e03030', color: '#fff' }}>
            B
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground leading-none">AXE Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5 leading-none">Solo Mining Monitor</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Status pill */}
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: isConnected ? 'var(--online)' : 'var(--offline)' }}
            />
            <span>{isConnected ? 'Live' : 'Preview'}</span>
            {lastUpdated && (
              <span className="text-muted-foreground/50">· {formatTimeAgo(lastUpdated)}</span>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh data"
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground',
              'hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50'
            )}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Settings */}
          <button
            onClick={onSettingsOpen}
            aria-label="Open settings"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  )
}
