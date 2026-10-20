'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pin } from 'lucide-react'
import { chatApi } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'
import { messagePreview } from '../utils'

// Thanh tin đã ghim dưới đầu hội thoại: bấm để nhảy tới tin
export function PinnedBanner({ conversationId, onJump }: { conversationId: string; onJump: (id: string) => void }) {
  const { data: pinned = [] } = useQuery({
    queryKey: queryKeys.chatPinned(conversationId),
    queryFn: () => chatApi.pinned(conversationId),
    staleTime: 60 * 1000
  })
  if (!pinned.length) return null
  const top = pinned[0]
  return (
    <button
      onClick={() => onJump(top.id)}
      className="sticky top-[56px] md:top-[calc(56px+var(--app-header-height,3.5rem))] z-20 mx-3 sm:mx-1 mb-1 flex w-[calc(100%-1.5rem)] sm:w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-xl bg-card/95 backdrop-blur px-3 py-2 text-left shadow-xs cursor-pointer hover:bg-muted/70"
    >
      <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-muted-foreground">
          Tin đã ghim{pinned.length > 1 ? ` (${pinned.length})` : ''} · {top.sender?.displayName}
        </span>
        <span className="block text-xs truncate">{messagePreview(top)}</span>
      </span>
    </button>
  )
}
