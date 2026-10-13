'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Loader2, MessageSquare, RotateCcw, SendHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { ConversationAvatar } from '@/components/chat/conversation-avatar'
import { Button } from '@/components/ui/button'
import {
  conversationTitle,
  useConversation,
  useMarkRead,
  useMessages,
  useTypingEmitter,
  useTypingStore,
  type UiMessage
} from '@/hooks/use-chat'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const me = useAppStore((s) => s.user)
  const { data: conv, isError } = useConversation(id)
  const { messages, isLoading, hasOlder, loadOlder, isLoadingOlder, send, remove } = useMessages(id)
  const typing = useTyping(id, me?.id)
  const bottomRef = useRef<HTMLDivElement>(null)
  const latest = messages[messages.length - 1]
  useMarkRead(id, latest, me?.id)

  // Cuộn xuống cuối khi có tin mới / AI đang trả lời dần
  const latestKey = latest ? `${latest.id}:${latest.content.length}` : ''
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [latestKey, isLoading])

  if (isError) {
    return (
      <div className="py-24 text-center space-y-3 text-muted-foreground">
        <MessageSquare className="h-10 w-10 mx-auto opacity-30" />
        <p className="text-sm font-medium">Không mở được hội thoại này.</p>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push('/messages')}>
          Về tin nhắn
        </Button>
      </div>
    )
  }

  const isAi = conv?.type === 'ai'
  const other = conv?.type === 'direct' ? conv.members[0] : null

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-3 py-2.5 flex items-center gap-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => router.push('/messages')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {conv && <ConversationAvatar conversation={conv} className="h-8 w-8" />}
        <div className="min-w-0">
          {other ? (
            <Link href={`/${other.username}`} className="text-sm font-semibold truncate hover:underline block">
              {conversationTitle(conv!)}
            </Link>
          ) : (
            <p className="text-sm font-semibold truncate">{conv ? conversationTitle(conv) : 'Đang tải…'}</p>
          )}
          <p className="text-[11px] text-muted-foreground truncate">
            {typing
              ? typing
              : isAi
                ? 'Trợ lý học tập · AI có thể nhầm, hãy kiểm tra nguồn'
                : conv?.type === 'group'
                  ? `${conv.memberCount} thành viên`
                  : other
                    ? `@${other.username}`
                    : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 px-3 sm:px-1 py-3 space-y-1.5">
        {hasOlder && (
          <div className="flex justify-center pb-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs rounded-full" disabled={isLoadingOlder} onClick={loadOlder}>
              {isLoadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Xem tin cũ hơn'}
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            {isAi ? <Sparkles className="h-9 w-9 mx-auto text-primary/50" /> : <MessageSquare className="h-9 w-9 mx-auto opacity-30" />}
            <p className="text-sm">{isAi ? 'Hỏi PU AI về môn học, bài tập, tài liệu…' : 'Gửi lời chào đầu tiên 👋'}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.clientMsgId || m.id}
              message={m}
              mine={m.sender?.id === me?.id}
              showName={conv?.type === 'group' && m.sender?.id !== me?.id && messages[i - 1]?.sender?.id !== m.sender?.id}
              onRetry={() => send(m.content, m)}
              onDelete={() => remove(m.id)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <Composer conversationId={id} onSend={send} disabled={!conv} placeholder={isAi ? 'Hỏi PU AI…' : 'Nhắn tin…'} />
    </div>
  )
}

// "Mai đang nhập…" (bỏ qua mục đã hết hạn)
function useTyping(conversationId: string, myId?: string): string | null {
  const entries = useTypingStore((s) => s.typing[conversationId])
  const { data: conv } = useConversation(conversationId)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 2000)
    return () => clearInterval(t)
  }, [])
  const now = Date.now()
  const ids = Object.entries(entries || {})
    .filter(([uid, exp]) => uid !== myId && exp > now)
    .map(([uid]) => uid)
  if (!ids.length) return null
  const names = ids.map((uid) => conv?.members.find((m) => m.id === uid)?.displayName || 'Ai đó')
  return `${names.join(', ')} đang nhập…`
}

function MessageBubble({
  message: m,
  mine,
  showName,
  onRetry,
  onDelete
}: {
  message: UiMessage
  mine: boolean
  showName: boolean
  onRetry: () => void
  onDelete: () => void
}) {
  const isAi = m.kind === 'ai'
  return (
    <div className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}>
      {showName && m.sender && <span className="text-[11px] text-muted-foreground px-3 mb-0.5">{m.sender.displayName}</span>}
      <div className={cn('flex items-end gap-1.5 max-w-[85%]', mine && 'flex-row-reverse')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm break-words',
            m.deleted
              ? 'bg-transparent border border-dashed text-muted-foreground italic'
              : mine
                ? 'bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap'
                : isAi
                  ? 'bg-card rounded-bl-md'
                  : 'bg-card rounded-bl-md whitespace-pre-wrap',
            m.status === 'failed' && 'opacity-60'
          )}
        >
          {m.deleted ? (
            'Tin nhắn đã thu hồi'
          ) : isAi ? (
            m.status === 'streaming' && !m.content ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" /> Đang suy nghĩ…
              </span>
            ) : (
              <>
                <MarkdownPreview content={m.content} className="prose-sm max-w-none" />
                {m.blocks && m.blocks.length > 0 && m.status === 'done' && (
                  <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">Nguồn tham khảo</p>
                    {m.blocks.map((b) => (
                      <Link
                        key={`${b.ref.type}:${b.ref.id}`}
                        href={b.ref.type === 'post' ? `/post/${b.ref.id}` : `/search?q=${encodeURIComponent(b.title)}&type=documents`}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        {b.ref.type === 'post' ? <MessageSquare className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{b.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )
          ) : (
            m.content
          )}
        </div>
        {mine && !m.deleted && m.status === 'done' && (
          <button
            onClick={onDelete}
            title="Thu hồi"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground px-2 mt-0.5">
        {m.status === 'sending' ? (
          'Đang gửi…'
        ) : m.status === 'failed' ? (
          <button onClick={onRetry} className="text-destructive inline-flex items-center gap-1 cursor-pointer">
            <RotateCcw className="h-3 w-3" /> Gửi lỗi · thử lại
          </button>
        ) : (
          timeOf(m.createdAt)
        )}
      </span>
    </div>
  )
}

function Composer({
  conversationId,
  onSend,
  disabled,
  placeholder
}: {
  conversationId: string
  onSend: (content: string) => void
  disabled: boolean
  placeholder: string
}) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const typing = useTypingEmitter(conversationId)

  // Tự giãn chiều cao theo nội dung (tối đa ~6 dòng)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const submit = () => {
    const content = text.trim()
    if (!content || disabled) return
    onSend(content)
    setText('')
    typing.stop()
  }

  return (
    <div className="sticky bottom-14 md:bottom-0 z-20 bg-surface/95 backdrop-blur-md px-3 sm:px-1 py-2.5">
      <div className="flex items-end gap-2 rounded-2xl bg-card px-3 py-2">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value)
            typing.onInput()
          }}
          onKeyDown={(e) => {
            // Enter gửi, Shift+Enter xuống dòng (bỏ qua khi đang gõ dấu IME)
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="flex-1 resize-none bg-transparent text-sm outline-none py-1.5 max-h-40"
        />
        <Button size="icon" className="h-8 w-8 rounded-full shrink-0" disabled={!text.trim() || disabled} onClick={submit}>
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
