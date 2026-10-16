'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ComposerProgressRingProps {
  currentLength: number
  maxLength?: number
  className?: string
}

export function ComposerProgressRing({ currentLength, maxLength = 1000, className }: ComposerProgressRingProps) {
  if (currentLength === 0) return null

  const size = 24
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(100, (currentLength / maxLength) * 100)
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  const remaining = maxLength - currentLength

  const isNearLimit = remaining <= 100 && remaining > 0
  const isOverLimit = remaining <= 0

  let strokeColor = 'stroke-primary'
  if (isOverLimit) {
    strokeColor = 'stroke-destructive'
  } else if (isNearLimit) {
    strokeColor = 'stroke-amber-500'
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90 transform">
          {/* Background circle */}
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-muted fill-none" />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn('fill-none transition-all duration-150', strokeColor)}
          />
        </svg>
      </div>

      {remaining <= 50 && <span className={cn('text-[10px] font-bold', isOverLimit ? 'text-destructive' : 'text-amber-500')}>{remaining}</span>}
    </div>
  )
}
