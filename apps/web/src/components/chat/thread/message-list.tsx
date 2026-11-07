'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import type { UiMessage } from '@/hooks/chat'
import { useStickToBottom } from '@/hooks/use-stick-to-bottom'
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
  aiHint?: boolean
  columnClass?: string // N7AI: cột nội dung căn giữa, thanh cuộn nằm mép ngoài
  onAskUserSelect?: (answer: string) => void // N7AI: chọn đáp án ở thẻ ask_user (câu trả lời mới nhất)
}

// Dòng tin: vạch ngày, gộp tin liên tiếp, tin hệ thống, "Đã xem", neo đáy (mở ở tin mới nhất), cuộn lên tải tin cũ
// Tin cuối của cụm cùng người (tin kế tiếp khác người / khác ngày / hệ thống / không có)
const isGroupEnd = (next: UiMessage | undefined, m: UiMessage) =>
  !next || next.kind === 'system' || !sameDay(m.createdAt, next.createdAt) || !isContinuation(m, next)

export function MessageList({
  conversation,
  messages,
  myId,
  hasOlder,
  isLoadingOlder,
  loadOlder,
  jumpTo,
  onJumpHandled,
  onJump,
  onRetry,
  handlers,
  columnClass,
  aiHint = false,
  onAskUserSelect
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const isGroup = conversation?.type === 'group'
  const latest = messages[messages.length - 1]
  // Chỉ hiện gợi ý dưới câu trả lời AI cuối cùng (đã xong)

  // Mở ở tin mới nhất ngay frame đầu; tin mới / AI trả lời dần giữ ở đáy nếu đang ở đáy
  const { stick, release } = useStickToBottom(listRef, latest?.conversationId)
  const isAi = conversation ? conversation.type === 'ai' : aiHint
  // Mình vừa gửi ⇒ thường: về đáy. N7AI: đẩy tin của mình lên đầu khung, chừa khoảng trống phía dưới cho câu trả lời stream
  const mineLatest = latest?.sender?.id === myId ? latest?.clientMsgId || latest?.id : undefined
  const innerRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const [anchorKey, setAnchorKey] = useState<string | null>(null)
  const follow = useRef(false) // câu trả lời đã dài quá khung ⇒ bám theo đáy khi stream
  const seenMine = useRef<string | undefined>(mineLatest) // lần mở hội thoại không tính là "vừa gửi"
  useLayoutEffect(() => {
    if (!mineLatest || seenMine.current === mineLatest) return
    seenMine.current = mineLatest
    if (isAi) {
      release()
      follow.current = false
      setAnchorKey(mineLatest)
    } else stick()
  }, [mineLatest, stick, release, isAi])
  useLayoutEffect(() => {
    if (!mineLatest || isAi || anchorKey) return
    stick()
  }, [mineLatest, isAi, anchorKey, stick])

  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const anchorEl = useCallback(() => {
    const m = anchorKey ? messagesRef.current.find((x) => (x.clientMsgId || x.id) === anchorKey) : undefined
    return m ? document.getElementById(`msg-${m.id}`) : null
  }, [anchorKey])

  // Khoảng trống cuối = phần khung còn dư dưới cụm "tin của mình + câu trả lời" ⇒ tin của mình đứng ở đỉnh, câu trả lời lấp dần
  const layoutSpacer = useCallback(() => {
    const list = listRef.current
    const sp = spacerRef.current
    if (!list || !sp) return
    const el = anchorKey ? anchorEl() : null
    if (!el) {
      sp.style.height = '0px'
      return
    }
    const base = list.getBoundingClientRect().top - list.scrollTop
    const top = el.getBoundingClientRect().top - base
    const end = sp.getBoundingClientRect().top - base
    const h = Math.max(0, list.clientHeight - (end - top) - 8)
    sp.style.height = `${h}px`
    if (h === 0 && follow.current) list.scrollTop = list.scrollHeight
    else if (h === 0 && end - top > list.clientHeight * 0.9) follow.current = true
  }, [anchorKey, anchorEl])

  useLayoutEffect(() => {
    layoutSpacer()
  }, [layoutSpacer, messages])
  useEffect(() => {
    const inner = innerRef.current
    const list = listRef.current
    if (!inner || !list || !isAi) return
    const ro = new ResizeObserver(layoutSpacer)
    ro.observe(inner)
    ro.observe(list)
    const stop = () => {
      follow.current = false
    }
    list.addEventListener('wheel', stop, { passive: true })
    list.addEventListener('touchstart', stop, { passive: true })
    return () => {
      ro.disconnect()
      list.removeEventListener('wheel', stop)
      list.removeEventListener('touchstart', stop)
    }
  }, [layoutSpacer, isAi])
  // Vừa gửi: cuộn mượt tin của mình lên đỉnh
  useLayoutEffect(() => {
    if (!anchorKey) return
    const list = listRef.current
    const el = anchorEl()
    if (!list || !el) return
    layoutSpacer()
    const top = el.getBoundingClientRect().top - (list.getBoundingClientRect().top - list.scrollTop) - 8
    list.scrollTo({ top, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey])

  // Cuộn gần đầu ⇒ tự tải trang tin cũ hơn; giữ nguyên tin đang nhìn khi chèn phía trên
  const topRef = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ id: string; top: number } | null>(null)
  const firstId = messages[0]?.id
  useEffect(() => {
    const el = topRef.current
    if (!el || !hasOlder || isLoadingOlder || !firstId) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        const first = document.getElementById(`msg-${firstId}`)
        anchor.current = first ? { id: firstId, top: first.getBoundingClientRect().top } : null
        loadOlder()
      },
      { root: listRef.current, rootMargin: '600px 0px 0px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasOlder, isLoadingOlder, firstId, loadOlder])
  useLayoutEffect(() => {
    const a = anchor.current
    if (!a || a.id === firstId) return
    const el = document.getElementById(`msg-${a.id}`)
    if (el && listRef.current) listRef.current.scrollTop += (el.getBoundingClientRect().top - a.top)
    anchor.current = null
  }, [firstId])

  // Nhảy tới tin (tải thêm trang cũ nếu chưa có)
  useEffect(() => {
    if (!jumpTo) return
    const el = document.getElementById(`msg-${jumpTo}`)
    if (el) {
      release()
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setHighlight(jumpTo)
      onJumpHandled()
      const t = setTimeout(() => setHighlight(null), 1800)
      return () => clearTimeout(t)
    }
    if (hasOlder && !isLoadingOlder) loadOlder()
    else if (!hasOlder) onJumpHandled()
  }, [jumpTo, messages.length, hasOlder, isLoadingOlder, loadOlder, onJumpHandled, release])

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
    <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-1 pt-2 pb-4 overscroll-contain animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out">
      <div ref={innerRef} className={columnClass}>
      <div ref={topRef} aria-hidden />
      {isLoadingOlder && (
        <div className="flex justify-center pb-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Đang tải tin cũ hơn" />
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
              <p id={`msg-${m.id}`} className="my-3 text-center text-[11px] text-muted-foreground px-6">
                {m.content}
              </p>
            ) : (
              <MessageBubble
                message={m}
                mine={mine}
                myId={myId}
                continued={!newDay && isContinuation(prev, m)}
                groupEnd={isGroupEnd(messages[i + 1], m)}
                showAvatar={conversation?.type !== 'direct'}
                showName={isGroup && !mine}
                seenLabel={seenFor(m)}
                highlighted={highlight === m.id}
                onJumpTo={onJump}
                onRetry={onRetry}
                handlers={handlers}
                onAskUserSelect={m.id === latest?.id && latest.status === 'done' ? onAskUserSelect : undefined}
              />
            )}
          </React.Fragment>
        )
      })}
      <div ref={spacerRef} aria-hidden />
      </div>
    </div>
  )
}
