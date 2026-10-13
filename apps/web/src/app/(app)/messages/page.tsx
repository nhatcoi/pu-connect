'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageCircle, PenSquare, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PageAside } from '@/components/layout/page-aside'
import { AiStudyCard } from '@/components/chat/ai/ai-study-card'
import { ConversationItem } from '@/components/chat/conversation-item'
import { NewChatPanel } from '@/components/chat/new-chat-panel'
import { Button } from '@/components/ui/button'
import { chatApi, useConversations } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'

type Filter = 'all' | 'unread' | 'group'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'group', label: 'Nhóm' }
]

// Danh sách hội thoại (mobile & desktop đều tách 2 màn: /messages và /messages/[id])
export default function MessagesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const myId = useAppStore((s) => s.user?.id)
  const { data: conversations = [], isPending } = useConversations()
  const [composing, setComposing] = useState(false)
  const [openingAi, setOpeningAi] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const hasAi = conversations.some((c) => c.type === 'ai')

  const openAi = async () => {
    setOpeningAi(true)
    try {
      const conv = await chatApi.openAi()
      void qc.invalidateQueries({ queryKey: queryKeys.conversations })
      router.push(`/messages/${conv.id}`)
    } catch (err: any) {
      toast.error(err?.message || 'Không mở được PU AI')
      setOpeningAi(false)
    }
  }

  const visible = conversations.filter((c) => (filter === 'unread' ? c.unreadCount > 0 : filter === 'group' ? c.type === 'group' : true))

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

      {!hasAi && !isPending && (
        <button
          onClick={openAi}
          disabled={openingAi}
          className="mx-2 sm:mx-0 mb-2.5 w-[calc(100%-1rem)] sm:w-full rounded-xl bg-gradient-to-r from-primary/10 to-brand-orange/10 hover:from-primary/15 hover:to-brand-orange/15 p-4 flex items-center gap-3 text-left cursor-pointer"
        >
          <div className="h-10 w-10 rounded-full bg-card text-primary flex items-center justify-center shrink-0">
            {openingAi ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold">Học cùng PU AI</p>
            <p className="text-xs text-muted-foreground">Giải thích bài, tạo quiz & flashcard, tóm tắt tài liệu, lập lộ trình ôn thi.</p>
          </div>
        </button>
      )}

      {isPending ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground space-y-2">
          <MessageCircle className="h-10 w-10 mx-auto opacity-30 text-primary" />
          <p className="text-sm font-medium">{filter === 'all' ? 'Chưa có hội thoại nào' : filter === 'unread' ? 'Đã đọc hết tin nhắn 🎉' : 'Chưa tham gia nhóm chat nào'}</p>
          {filter !== 'unread' && <p className="text-xs">Bấm “Mới” để nhắn tin hoặc tạo nhóm học.</p>}
        </div>
      ) : (
        <div className="mx-2 sm:mx-0 rounded-xl bg-card overflow-hidden divide-y divide-border/50">
          {visible.map((c) => (
            <ConversationItem key={c.id} conversation={c} myId={myId} />
          ))}
        </div>
      )}

      <PageAside>
        <AiStudyCard onOpen={openAi} opening={openingAi} />
      </PageAside>
    </>
  )
}
