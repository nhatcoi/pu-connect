'use client'

import React from 'react'
import { X } from 'lucide-react'
import type { AiMode, AiSuggestion } from '@pu/schemas'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiSuggestions } from '@/hooks/chat'
import { AI_MODE_META } from './ai-modes'

// Bảng gợi ý trên ô soạn khi chọn chế độ giữa hội thoại (2 hàng chip cuộn ngang)
// Mid-conversation suggestion tray for the selected study mode
export function AiSuggestionPanel({ mode, onPick, onClose }: { mode: AiMode; onPick: (s: AiSuggestion) => void; onClose: () => void }) {
  const { data, isPending } = useAiSuggestions(mode)
  const meta = AI_MODE_META[mode]
  const Icon = meta.icon

  return (
    <div className="mb-2 rounded-2xl bg-card px-3 pt-2.5 pb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Icon className="h-4 w-4 text-primary" /> {meta.label}
          <span className="text-[11px] font-normal text-muted-foreground">· {meta.hint}</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Đóng gợi ý" className="p-1 text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-1.5 overflow-x-auto no-scrollbar">
        {isPending
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 w-48 rounded-full" />)
          : data?.items?.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => onPick(s)}
                className="h-8 max-w-[280px] truncate rounded-full border border-border px-3 text-xs hover:bg-muted hover:border-primary/30 transition-colors cursor-pointer"
              >
                {s.text}
              </button>
            ))}
      </div>
    </div>
  )
}
