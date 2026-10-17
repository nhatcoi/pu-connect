'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, PenSquare } from 'lucide-react'
import { PageAside } from '@/components/layout/page-aside'
import { AiQuickRow } from '@/components/chat/ai/ai-quick-row'
import { AiStudyCard } from '@/components/chat/ai/ai-study-card'
import { ConversationListSkeleton } from '@/components/skeletons/chat-skeleton'
import { ConversationItem } from '@/components/chat/conversation-item'
import { NewChatPanel } from '@/components/chat/new-chat-panel'
import { Button } from '@/components/ui/button'
import { PuaiFab } from '@/components/puai/puai-fab'
import { useConversations } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ConversationFilter as Filter } from '@pu/schemas'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'group', label: 'Nhóm' }
]

// Danh sách hội thoại (mobile & desktop đều tách 2 màn: /messages và /messages/[id])
// PU AI: 1 thread chat nhanh đứng đầu (server xếp hạng) + nút nổi mở không gian /puai
export default function MessagesPage() {
  const myId = useAppStore((s) => s.user?.id)
  const [composing, setComposing] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  // Lọc ở server, mỗi bộ lọc 1 cache
  const { conversations: visible, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useConversations(filter)
  // Chưa từng chat PU AI ⇒ dòng mở đầu thay cho thread chat nhanh
  const showAiRow = filter === 'all' && !isPending && !visible.some((c) => c.type === 'ai')

  // Cuộn gần cuối ⇒ tải trang tiếp
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && !isFetchingNextPage && void fetchNextPage(), { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" /> Tin nhắn
          </h1>
          <Button size="sm" variant={composing ? 'secondary' : 'outline'} className="h-8 rounded-full gap-1.5 text-xs" onClick={() => setComposing((v) => !v)}>
            <PenSquare className="h-3.5 w-3.5" /> Mới
          </Button>
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium cursor-pointer transition-colors',
                filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {composing && <NewChatPanel onClose={() => setComposing(false)} />}

      {showAiRow && (
        <div className={cn('mx-2 sm:mx-0 rounded-xl bg-card overflow-hidden', visible.length > 0 && 'rounded-b-none border-b border-border/50')}>
          <AiQuickRow />
        </div>
      )}

      {isPending ? (
        <ConversationListSkeleton />
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground space-y-2">
          <MessageCircle className="h-10 w-10 mx-auto opacity-30 text-primary" />
          <p className="text-sm font-medium">
            {filter === 'all' ? 'Chưa có hội thoại nào' : filter === 'unread' ? 'Đã đọc hết tin nhắn 🎉' : 'Chưa tham gia nhóm chat nào'}
          </p>
          {filter !== 'unread' && <p className="text-xs">Bấm “Mới” để nhắn tin hoặc tạo nhóm học.</p>}
        </div>
      ) : (
        <div className={cn('mx-2 sm:mx-0 rounded-xl bg-card overflow-hidden divide-y divide-border/50', showAiRow && 'rounded-t-none')}>
          {visible.map((c) => (
            <ConversationItem key={c.id} conversation={c} myId={myId} />
          ))}
        </div>
      )}
      <div ref={sentinelRef} aria-hidden />
      {isFetchingNextPage && (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải thêm hội thoại" />
        </div>
      )}

      <PuaiFab />
      <PageAside>
        <AiStudyCard />
      </PageAside>
    </>
  )
}
