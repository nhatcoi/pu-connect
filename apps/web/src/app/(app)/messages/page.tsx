'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageCircle, PenSquare, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { ConversationAvatar } from '@/components/chat/conversation-avatar'
import { NewChatPanel } from '@/components/chat/new-chat-panel'
import { Button } from '@/components/ui/button'
import { chatApi, conversationTitle, useConversations } from '@/hooks/use-chat'
import { queryKeys } from '@/lib/query-keys'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useAppStore } from '@/store'

// Danh sách hội thoại (mobile & desktop đều tách 2 màn: /messages và /messages/[id])
export default function MessagesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const myId = useAppStore((s) => s.user?.id)
  const { data: conversations = [], isPending } = useConversations()
  const [composing, setComposing] = useState(false)
  const [openingAi, setOpeningAi] = useState(false)
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

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" /> Tin nhắn
        </h1>
        <Button size="sm" variant="outline" className="h-8 rounded-full gap-1.5 text-xs" onClick={() => setComposing((v) => !v)}>
          <PenSquare className="h-3.5 w-3.5" /> Mới
        </Button>
      </div>

      {composing && <NewChatPanel onClose={() => setComposing(false)} />}

      {!hasAi && !isPending && (
        <button
          onClick={openAi}
          disabled={openingAi}
          className="mx-2 sm:mx-0 mb-2.5 w-[calc(100%-1rem)] sm:w-full rounded-xl bg-primary/5 hover:bg-primary/10 p-4 flex items-center gap-3 text-left cursor-pointer"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {openingAi ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold">Hỏi PU AI</p>
            <p className="text-xs text-muted-foreground">Trợ lý học tập, trả lời dựa trên bài viết & tài liệu trên PU Connector.</p>
          </div>
        </button>
      )}

      {isPending ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground space-y-2">
          <MessageCircle className="h-10 w-10 mx-auto opacity-30 text-primary" />
          <p className="text-sm font-medium">Chưa có hội thoại nào</p>
          <p className="text-xs">Bấm “Mới” để nhắn tin với bạn học.</p>
        </div>
      ) : (
        <div className="mx-2 sm:mx-0 rounded-xl bg-card overflow-hidden divide-y divide-border/50">
          {conversations.map((c) => {
            const last = c.lastMessage
            const unread = c.unreadCount > 0
            const preview = !last
              ? c.type === 'ai'
                ? 'Hỏi bất cứ điều gì về môn học'
                : 'Bắt đầu cuộc trò chuyện'
              : last.deleted
                ? 'Tin nhắn đã thu hồi'
                : `${last.sender?.id === myId ? 'Bạn: ' : c.type === 'group' && last.sender ? `${last.sender.displayName}: ` : ''}${last.content || '…'}`
            return (
              <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <ConversationAvatar conversation={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm truncate flex-1', unread ? 'font-bold' : 'font-medium')}>{conversationTitle(c)}</p>
                    {c.lastMessageAt && <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeTime(c.lastMessageAt)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={cn('text-xs truncate flex-1', unread ? 'text-foreground font-medium' : 'text-muted-foreground')}>{preview}</p>
                    {unread && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-orange text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
