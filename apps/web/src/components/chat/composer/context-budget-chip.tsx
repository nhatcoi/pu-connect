'use client'

import React from 'react'
import { Sparkles, Zap } from 'lucide-react'
import { useAiQuota } from '@/hooks/chat/use-ai'
import { cn } from '@/lib/utils'

interface ContextBudgetChipProps {
  className?: string
}

export function ContextBudgetChip({ className }: ContextBudgetChipProps) {
  const { data: quota, isLoading } = useAiQuota()

  if (isLoading || !quota) {
    return (
      <div className={cn('inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground', className)}>
        <Sparkles className="h-3 w-3 animate-pulse text-primary" />
        <span>Đang kiểm tra quota...</span>
      </div>
    )
  }

  const remaining = Math.max(0, quota.limit - quota.used)
  const percent = Math.min(100, Math.round((quota.used / quota.limit) * 100))

  const isLow = remaining <= 5 && remaining > 0
  const isOut = remaining === 0

  return (
    <div
      title={`Đã dùng ${quota.used}/${quota.limit} lượt hôm nay. Làm mới lúc 00:00.`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors select-none',
        isOut
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : isLow
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground',
        className
      )}
    >
      <Zap className={cn('h-3 w-3', isOut ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-primary')} />
      <span>
        {remaining}/{quota.limit} lượt
      </span>
      <span className="hidden sm:inline opacity-70">({100 - percent}%)</span>
    </div>
  )
}

