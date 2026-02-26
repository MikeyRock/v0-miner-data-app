'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  icon?: ReactNode
  highlight?: boolean
  className?: string
  sublabel?: string
}

export function StatCard({ label, value, unit, icon, highlight, className, sublabel }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4',
        highlight && 'border-primary/40 bg-primary/5',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-mono text-2xl font-semibold', highlight && 'text-primary')}>
          {value}
        </span>
        {unit && (
          <span className="font-mono text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
      {sublabel && (
        <span className="text-xs text-muted-foreground">{sublabel}</span>
      )}
    </div>
  )
}
