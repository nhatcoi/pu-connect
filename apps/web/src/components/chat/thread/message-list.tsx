'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import type { UiMessage } from '@/hooks/chat'
import { dayLabel, isContinuation, sameDay } from '../utils'
import { MessageBubble } from './message-bubble'
import type { MessageHandlers } from './message-actions'

interface MessageListProps {
  conversation: ConversationSummary | undefined
  messages: UiMessage[]
  myId?: string
  hasOlder: boolean
  isLoadingOlder: boolean
  loadOlder: () => void
  jumpTo: string | null // id tin cần cuộn tới (trả lời, ghim, tìm kiếm)
  onJumpHandled: () => void
  onJump: (id: string) => void
  onRetry: (m: UiMessage) => void
  handlers: MessageHandlers
}

// Dòng tin: vạch ngày, gộp tin liên tiếp, tin hệ thống, "Đã xem", tự cuộn xuống khi có tin mới
export function MessageList({ conversation, messages, myId, hasOlder, isLoadingOlder, loadOlder, jumpTo, onJumpHandled, onJump, onRetry, handlers }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const isGroup = conversation?.type === 'group'
  const latest = messages[messages.length - 1]

  // Cuộn xuống cuối khi có tin mới / AI đang trả lời dần
  const latestKey = latest ? `${latest.id}:${latest.content.length}:${latest.reactions.length}` : ''
  const nearBottom = useRef(true)
  useEffect(() => {
    const onScroll = () => {
      nearBottom.current = window.innerHeight + window.scrollY >= document.body.scrollHeight - 240
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useLayoutEffect(() => {
    if (nearBottom.current || latest?.sender?.id === myId) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [latestKey, latest?.sender?.id, myId])

  // Nhảy tới tin (tải thêm trang cũ nếu chưa có)
  useEffect(() => {
    if (!jumpTo) return
    const el = document.getElementById(`msg-${jumpTo}`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setHighlight(jumpTo)
      onJumpHandled()
      const t = setTimeout(() => setHighlight(null), 1800)
      return () => clearTimeout(t)
    }
    if (hasOlder && !isLoadingOlder) loadOlder()
    else if (!hasOlder) onJumpHandled()
  }, [jumpTo, messages.length, hasOlder, isLoadingOlder, loadOlder, onJumpHandled])

  // "Đã xem": DM ⇒ dưới tin cuối của mình mà người kia đã đọc; nhóm ⇒ số người đã đọc tin cuối
  const seenFor = (m: UiMessage): string | null => {
    if (!conversation || conversation.type === 'ai' || m.sender?.id !== myId || m.id.startsWith('tmp-')) return null
    const lastMine = [...messages].reverse().find((x) => x.sender?.id === myId && !x.id.startsWith('tmp-'))
    if (lastMine?.id !== m.id) return null
    const readers = Object.values(conversation.readCursors).filter((cursor) => Number(cursor) >= Number(m.id)).length
    if (!readers) return 'Đã gửi'
    return conversation.type === 'direct' ? 'Đã xem' : `${readers} người đã xem`
  }

  return (
    <div className="flex-1 px-3 sm:px-1 pt-2 pb-4">
      {hasOlder && (
        <div className="flex justify-center pb-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs rounded-full" disabled={isLoadingOlder} onClick={loadOlder}>
            {isLoadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Xem tin cũ hơn'}
          </Button>
        </div>
      )}
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const newDay = !prev || !sameDay(prev.createdAt, m.createdAt)
        const mine = m.sender?.id === myId
        return (
          <React.Fragment key={m.clientMsgId || m.id}>
            {newDay && (
              <div className="flex items-center gap-3 my-4 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span className="first-letter:uppercase">{dayLabel(m.createdAt)}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            {m.kind === 'system' ? (
              <p className="my-3 text-center text-[11px] text-muted-foreground px-6">{m.content}</p>
            ) : (
              <MessageBubble
                message={m}
                mine={mine}
                myId={myId}
                continued={!newDay && isContinuation(prev, m)}
                showAvatar={conversation?.type !== 'direct'}
                showName={isGroup && !mine}
                seenLabel={seenFor(m)}
                highlighted={highlight === m.id}
                onJumpTo={onJump}
                onRetry={onRetry}
                handlers={handlers}
              />
            )}
          </React.Fragment>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
