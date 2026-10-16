'use client'

import React, { useEffect, useRef } from 'react'
import { BadgeCheck, Loader2 } from 'lucide-react'
import type { MentionCandidate } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { N7AiMark } from '@/components/brand/pu-logo'
import { MENTION_REASON_LABEL, PUAI_USERNAME } from '@/lib/mention'
import { cn } from '@/lib/utils'

interface MentionPopoverProps {
  id: string
  items: MentionCandidate[]
  index: number
  isLoading?: boolean
  onHover: (i: number) => void
  onSelect: (c: MentionCandidate) => void
  className?: string
}

export const mentionOptionId = (listId: string, i: number) => `${listId}-opt-${i}`

// Danh sách gợi ý @mention (listbox; bàn phím do textarea điều khiển qua aria-activedescendant)
export function MentionPopover({ id, items, index, isLoading, onHover, onSelect, className }: MentionPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Giữ mục đang chọn trong tầm nhìn khi dùng phím mũi tên
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(mentionOptionId(id, index))}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, index])

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label="Gợi ý nhắc tên"
      className={cn(
        'z-30 max-h-72 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-100',
        className
      )}
    >
      {isLoading && items.length === 0 ? (
        <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang tìm…
        </div>
      ) : (
        items.map((c, i) => {
          const isAi = c.username === PUAI_USERNAME
          const hint = isAi ? 'Hỏi PU AI về bài viết này' : MENTION_REASON_LABEL[c.reason]
          return (
            <div
              key={c.username}
              id={mentionOptionId(id, i)}
              role="option"
              aria-selected={i === index}
              // Giữ focus ở textarea khi bấm chuột
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onHover(i)}
              onClick={() => onSelect(c)}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
                i === index ? 'bg-muted' : 'hover:bg-muted/60',
                isAi && items.length > 1 && 'mb-1'
              )}
            >
              {isAi ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                  <N7AiMark className="h-[68%] w-[68%]" />
                </span>
              ) : (
                <Avatar className="h-7 w-7 shrink-0 border border-border">
                  <AvatarImage src={c.avatarUrl || ''} alt="" />
                  <AvatarFallback className="bg-muted text-[10px] font-bold">{c.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <span className="truncate">{c.displayName}</span>
                  {c.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                  {isAi && <span className="rounded bg-primary/10 px-1 py-px text-[9px] font-bold tracking-wide text-primary">AI</span>}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  @{c.username}
                  {hint && <> · {hint}</>}
                </span>
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
