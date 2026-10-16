'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, MessageCircle, PenSquare } from 'lucide-react'
import { N7AiMark } from '@/components/brand/pu-logo'
import { PageAside } from '@/components/layout/page-aside'
import { AiStudyCard } from '@/components/chat/ai/ai-study-card'
import { ConversationListSkeleton } from '@/components/skeletons/chat-skeleton'
import { ConversationItem } from '@/components/chat/conversation-item'
import { NewChatPanel } from '@/components/chat/new-chat-panel'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/chat'
import { PUAI_HOME } from '@/lib/puai-routes'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ConversationFilter as Filter } from '@pu/schemas'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'group', label: 'Nhóm' }
]

// Danh sách DM & nhóm (mobile & desktop đều tách 2 màn: /messages và /messages/[id]); PU AI ở không gian /puai
export default function MessagesPage() {
  const myId = useAppStore((s) => s.user?.id)
  const [composing, setComposing] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  // Lọc ở server, mỗi bộ lọc 1 cache
  const { conversations: visible, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useConversations(filter)

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

      {/* Lối vào không gian PU AI (mobile không có cột phải) */}
      <Link
        href={PUAI_HOME}
        className="lg:hidden mx-2 sm:mx-0 mb-2.5 rounded-xl bg-gradient-to-r from-primary/10 to-brand-orange/10 hover:from-primary/15 hover:to-brand-orange/15 p-4 flex items-center gap-3"
      >
        <div className="h-10 w-10 rounded-full bg-card flex items-center justify-center shrink-0">
          <N7AiMark className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Học cùng PU AI</p>
          <p className="text-xs text-muted-foreground">Giải thích bài, tạo quiz & flashcard, tóm tắt tài liệu, lập lộ trình ôn thi.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>

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
        <div className="mx-2 sm:mx-0 rounded-xl bg-card overflow-hidden divide-y divide-border/50">
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

      <PageAside>
        <AiStudyCard />
      </PageAside>
    </>
  )
}
