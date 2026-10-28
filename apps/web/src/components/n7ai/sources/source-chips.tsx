'use client'

import React from 'react'
import { X } from 'lucide-react'
import { useAiSources } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import { entryFromSource, KIND_ICON } from './doc-entries'

// Tài liệu đã gắn vào cuộc trò chuyện, hiện ngay trên ô soạn để biết N7AI đang đọc gì (bỏ ra bằng dấu ×)
export function SourceChips({ threadId }: { threadId: string }) {
  const { sources, remove } = useAiSources(threadId)
  if (!sources.length) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-1 pt-1 pb-2" aria-label="Tài liệu của cuộc trò chuyện">
      {sources.map((s) => {
        const entry = entryFromSource(s)
        const Icon = KIND_ICON[entry.kind]
        return (
          <span key={s.id} className={cn('flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-2 pr-1 text-xs', !s.inContext && 'opacity-50')} title={entry.title}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{entry.title}</span>
            <button type="button" onClick={() => remove.mutate(s.id)} aria-label={`Bỏ ${entry.title}`} className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-foreground/10">
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
