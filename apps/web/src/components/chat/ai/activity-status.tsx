'use client'

import React, { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AiStep } from '@pu/schemas'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface ActivityStatusProps {
  live: boolean
  steps?: AiStep[]
  durationMs?: number
  startedAt?: string
  writing?: boolean
  className?: string
  children?: React.ReactNode
}

function useElapsed(since: string | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [running])
  return since ? Math.max(0, now - new Date(since).getTime()) : 0
}

const formatSeconds = (ms: number) => {
  const sec = ms / 1000
  return sec < 10 ? `${sec.toFixed(0)}s` : `${Math.round(sec)}s`
}

export function ActivityStatus({
  live,
  steps = [],
  durationMs,
  startedAt,
  writing,
  className,
  children
}: ActivityStatusProps) {
  const [open, setOpen] = useState(false)
  const elapsed = useElapsed(startedAt, live)
  const currentDuration = live ? elapsed : (durationMs ?? 4000)
  const durationLabel = formatSeconds(currentDuration)

  const hasExpandableContent = steps.length > 0 || !!children
  const runningStep = steps.find((s) => s.status === 'running')

  const label = live
    ? runningStep
      ? runningStep.label
      : writing
        ? 'Writing response…'
        : 'Thinking…'
    : 'Done'

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn('mb-2.5', className)}>
      <CollapsibleTrigger
        disabled={!hasExpandableContent}
        className={cn(
          'group inline-flex items-center gap-2 text-[13px] font-medium transition-colors select-none',
          live ? 'text-foreground' : 'text-muted-foreground/80 hover:text-foreground',
          !hasExpandableContent && 'cursor-default'
        )}
      >
        {live ? (
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            <svg
              className="h-3.5 w-3.5 animate-spin text-primary"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeDasharray="2.5 3"
              />
            </svg>
          </span>
        ) : (
          <svg
            className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeDasharray="2.2 2.6"
            />
          </svg>
        )}

        <span className={cn('font-semibold', live && 'animate-pulse text-foreground')}>
          {label}
        </span>

        <span className="text-[12px] font-medium tabular-nums text-muted-foreground/60">
          · {durationLabel}
        </span>

        {hasExpandableContent && (
          <ChevronDown
            size={13}
            className={cn(
              'text-muted-foreground/60 transition-transform duration-150 group-hover:text-foreground',
              open && 'rotate-180'
            )}
          />
        )}
      </CollapsibleTrigger>

      {hasExpandableContent && (
        <CollapsibleContent className="mt-2.5 pl-2 border-l border-border/40 text-xs">
          {children}
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

