'use client'

import React from 'react'
import { TextQuote } from 'lucide-react'
import type { ChatQuote } from '@pu/schemas'
import { useAiSources } from '@/hooks/chat'
import { entryFromSource } from '@/components/n7ai/sources/doc-entries'
import { openDoc } from '@/components/n7ai/sources/source-view-store'
import { cn } from '@/lib/utils'

// Đoạn trích người dùng đã chọn từ tài liệu (trên bong bóng câu hỏi); còn tài liệu gốc ⇒ bấm để mở lại
export function MessageQuotes({ quotes, threadId, mine }: { quotes: ChatQuote[]; threadId: string; mine: boolean }) {
  const { sources } = useAiSources(threadId)
  return (
    <div className={cn('flex max-w-full flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {quotes.map((q, i) => {
        const source = q.sourceId ? sources.find((s) => s.id === q.sourceId) : undefined
        const Card = source ? 'button' : 'div'
        return (
          <Card
            key={i}
            {...(source ? { type: 'button' as const, onClick: () => openDoc(entryFromSource(source)), title: 'Mở tài liệu' } : {})}
            className={cn('max-w-full rounded-xl border-l-2 border-primary bg-muted/70 px-3 py-1.5 text-left', source && 'cursor-pointer transition-colors hover:bg-muted')}
          >
            <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <TextQuote className="h-3 w-3 shrink-0" />
              <span className="truncate">{q.title}</span>
              {q.locator && <span className="shrink-0 font-mono text-primary">{q.locator}</span>}
            </span>
            <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap break-words text-xs text-foreground/90">{q.text}</span>
          </Card>
        )
      })}
    </div>
  )
}
