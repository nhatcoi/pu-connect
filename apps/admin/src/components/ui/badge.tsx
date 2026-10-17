import React from 'react'
import { cn } from '@/lib/api'

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'orange'

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-500/10 text-green-700 dark:text-green-400',
  warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  orange: 'bg-brand-orange/12 text-orange-700 dark:text-brand-orange'
}

export function Badge({
  tone = 'neutral',
  dot,
  className,
  children
}: {
  tone?: Tone
  dot?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap [&_svg]:size-3',
        TONES[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// Màu vai trò thống nhất toàn app
export const ROLE_TONE: Record<string, Tone> = {
  admin: 'danger',
  lecturer: 'primary',
  ta: 'success',
  club_lead: 'orange',
  student: 'neutral'
}
