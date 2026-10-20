'use client'

import React from 'react'
import type { AiMode } from '@pu/schemas'
import { cn } from '@/lib/utils'
import { AI_MODE_META, AI_MODE_ORDER } from '../ai/ai-modes'

// Chip chọn chế độ học (đặt trên ô soạn tin của N7AI); mức model nằm trong ô soạn tin
export function AiModeBar({ value, onChange }: { value: AiMode; onChange: (mode: AiMode) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1.5">
      {AI_MODE_ORDER.map((mode) => {
        const meta = AI_MODE_META[mode]
        const Icon = meta.icon
        const active = mode === value
        return (
          <button
            key={mode}
            type="button"
            title={meta.hint}
            onClick={() => onChange(mode)}
            className={cn(
              'shrink-0 flex items-center gap-1 rounded-full px-2.5 h-7 text-xs font-medium transition-colors cursor-pointer',
              active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {meta.label}
          </button>
        )
      })}
    </div>
  )
}
