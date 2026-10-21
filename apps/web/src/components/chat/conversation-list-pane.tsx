'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageCircle, PenSquare, Search, X } from 'lucide-react'
import { AiQuickRow } from '@/components/chat/ai/ai-quick-row'
import { ConversationListSkeleton } from '@/components/skeletons/chat-skeleton'
import { ConversationItem } from '@/components/chat/conversation-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { conversationTitle, useConversations } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ConversationFilter as Filter } from '@pu/schemas'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'group', label: 'Nhóm' }
]

interface ConversationListPaneProps {
  activeId?: string
  onCompose?: () => void
}

// Cột danh sách hội thoại: hiển thị trên mobile (/messages) và làm cột trái cố định trên desktop
export function ConversationListPane({ activeId, onCompose }: ConversationListPaneProps) {
  const myId = useAppStore((s) => s.user?.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Lọc ở server theo danh mục
  const { conversations: visible, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useConversations(filter)
  const showAiRow = filter === 'all' && !isPending && !visible.some((c) => c.type === 'ai')

  // Tìm kiếm cục bộ tức thì trên danh sách hội thoại
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return visible
    return visible.filter((c) => {
      const title = conversationTitle(c).toLowerCase()
      const memberNames = c.members.map((m) => `${m.displayName} ${m.username}`).join(' ').toLowerCase()
      return title.includes(q) || memberNames.includes(q)
    })
  }, [visible, searchQuery])

  // Cuộn gần cuối ⇒ tải trang tiếp
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      (e) => e[0].isIntersecting && !isFetchingNextPage && void fetchNextPage(),
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* 1. Header danh sách tin nhắn */}
      <div className="shrink-0 bg-surface/90 backdrop-blur-md px-3.5 pt-3 pb-2.5 space-y-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Tin nhắn
          </h1>
          {onCompose && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full gap-1.5 text-xs font-semibold px-3 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              onClick={onCompose}
            >
              <PenSquare className="h-3.5 w-3.5" />
              <span>Mới</span>
            </Button>
          )}
        </div>

        {/* Ô tìm kiếm nhanh */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            className="h-9 pl-9 pr-7 text-xs rounded-xl bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-border transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              aria-label="Xóa tìm kiếm"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Bộ lọc loại tin */}
        <div className="flex gap-1.5 pt-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-6 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors select-none',
                filter === f.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Danh sách cuộn độc lập */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
        {showAiRow && (
          <div className={cn('bg-card rounded-xl overflow-hidden mb-1', filtered.length > 0 && 'border-b border-border/40')}>
            <AiQuickRow />
          </div>
        )}

        {isPending ? (
          <ConversationListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-muted-foreground space-y-2 px-4">
            <MessageCircle className="h-9 w-9 mx-auto opacity-30 text-primary" />
            <p className="text-xs font-semibold text-foreground">
              {searchQuery
                ? 'Không tìm thấy cuộc trò chuyện phù hợp'
                : filter === 'all'
                  ? 'Chưa có hội thoại nào'
                  : filter === 'unread'
                    ? 'Đã đọc hết tin nhắn 🎉'
                    : 'Chưa tham gia nhóm chat nào'}
            </p>
            {!searchQuery && filter !== 'unread' && (
              <p className="text-[11px] text-muted-foreground">Bấm nút “Mới” để bắt đầu nhắn tin hoặc tạo nhóm học.</p>
            )}
          </div>
        ) : (
          filtered.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              myId={myId}
              isActive={activeId === c.id}
            />
          ))
        )}

        <div ref={sentinelRef} aria-hidden />
        {isFetchingNextPage && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải thêm hội thoại" />
          </div>
        )}
      </div>
    </div>
  )
}
