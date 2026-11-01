'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Pin, RotateCcw } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { N7AiMark } from '@/components/brand/pu-logo'
import type { UiMessage } from '@/hooks/chat'
import { isLinkOnly } from '@/lib/message-links'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { AiMessageBody } from '../ai/ai-message-body'
import { AssistantActionsBar } from '../ai/assistant-actions-bar'
import { AI_MODE_META } from '../ai/ai-modes'
import { messagePreview, timeOf } from '../utils'
import { AttachmentView } from './attachment-view'
import { SharedPostCard } from './shared-post-card'
import { MessageEmbedCard } from './message-embed-card'
import { MessageQuotes } from './message-quotes'
import { MessageActions, type MessageHandlers } from './message-actions'
import { MessageAiBadges, MessageRefs, MessageText } from './message-text'
import { ReactionsDialog } from './reactions-dialog'

// Màn cảm ứng không có hover ⇒ chạm vào tin để hiện thanh thao tác
const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

interface BubbleProps {
  message: UiMessage
  mine: boolean
  myId?: string
  continued: boolean // nối tiếp tin trước cùng người ⇒ ẩn tên/ảnh
  showAvatar: boolean // nhóm / AI: hiện ảnh đại diện người khác
  showName: boolean
  seenLabel: string | null
  highlighted: boolean
  onJumpTo: (id: string) => void
  onRetry: (m: UiMessage) => void
  handlers: MessageHandlers
  onAskUserSelect?: (answer: string) => void // chỉ truyền cho câu trả lời N7AI mới nhất
}

export function MessageBubble({
  message: m,
  mine,
  myId,
  continued,
  showAvatar,
  showName,
  seenLabel,
  highlighted,
  onJumpTo,
  onRetry,
  handlers,
  onAskUserSelect
}: BubbleProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const myUsername = useAppStore((s) => s.user?.username)
  const reactionCount = m.reactions.reduce((n, r) => n + r.userIds.length, 0)
  const isAi = m.kind === 'ai'
  const interactive = !m.deleted && !m.id.startsWith('tmp-') && m.status !== 'streaming'
  // Tin chỉ có một URL và đã có thẻ xem trước ⇒ chỉ hiện thẻ (chưa có thẻ ⇒ vẫn hiện link)
  const hasText = !!m.content && !m.deleted && !(m.meta?.embeds?.length && !m.attachments?.length && isLinkOnly(m.content))
  const mode = m.meta?.aiMode

  return (
    <div
      id={`msg-${m.id}`}
      className={cn(
        'group flex gap-2 scroll-mt-24',
        mine ? 'flex-row-reverse' : 'flex-row',
        continued ? 'mt-0.5' : isAi && !mine ? 'mt-5' : 'mt-3'
      )}
    >
      {/* Assistant message không có avatar bên lề để nội dung dàn rộng thoáng */}
      {showAvatar && !mine && !isAi && (
        <div className="w-7 shrink-0 self-end">
          {!continued &&
            m.sender &&
            (m.sender.isBot ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <N7AiMark className="h-[70%] w-[70%]" />
              </span>
            ) : (
              <Link href={`/${m.sender.username}`}>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={m.sender.avatarUrl || ''} />
                  <AvatarFallback className="text-[9px] font-bold">{m.sender.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
            ))}
        </div>
      )}

      {/* Tin N7AI (Markdown, bảng, code) cần rộng hơn tin chat thường */}
      <div
        className={cn(
          'flex flex-col min-w-0',
          isAi && !mine ? 'w-full max-w-full sm:max-w-[min(98%,56rem)] flex-1' : 'max-w-[85%] sm:max-w-[78%]',
          mine ? 'items-end' : 'items-start'
        )}
      >
        {/* Nhãn chế độ phía trên tin nhắn của người dùng (Chat / Ask Questions / Solve...) */}
        {mine && isAi && (
          <div className="flex justify-end pr-1 mb-1">
            <span className="text-[10.5px] font-medium tracking-wide text-muted-foreground select-none">
              {mode ? AI_MODE_META[mode]?.label || 'Chat' : 'Chat'}
            </span>
          </div>
        )}

        {showName && !continued && m.sender && !isAi && (
          <span className="text-[11px] text-muted-foreground px-3 mb-0.5">{m.sender.displayName}</span>
        )}

        {m.replyTo && !m.deleted && (
          <button
            onClick={() => onJumpTo(m.replyTo!.id)}
            className={cn(
              'mb-[-6px] pb-2.5 pt-1.5 px-3 rounded-t-2xl bg-muted/70 text-left max-w-full cursor-pointer',
              mine ? 'rounded-bl-2xl' : 'rounded-br-2xl'
            )}
          >
            <span className="block text-[10px] font-semibold text-muted-foreground">↩ {m.replyTo.senderName ?? 'Tin nhắn'}</span>
            <span className="block text-xs text-muted-foreground truncate max-w-64">
              {messagePreview({ content: m.replyTo.content, attachments: m.replyTo.hasAttachments ? [{ kind: 'file' }] : null, deleted: m.replyTo.deleted })}
            </span>
          </button>
        )}

        <div className={cn('flex items-center gap-1.5 max-w-full', mine && 'flex-row-reverse', isAi && 'w-full')}>
          <div className={cn('min-w-0 flex flex-col gap-1', isAi && 'flex-1')} onClick={() => interactive && isTouch() && setActionsOpen((v) => !v)}>
            {m.attachments && m.attachments.length > 0 && !m.deleted && <AttachmentView attachments={m.attachments} mine={mine} />}
            {m.meta?.sharedPost && !m.deleted && <SharedPostCard post={m.meta.sharedPost} mine={mine} />}
            {!!m.meta?.quotes?.length && !m.deleted && <MessageQuotes quotes={m.meta.quotes} threadId={m.conversationId} mine={mine} />}

            {isAi && !mine ? (
              // Assistant Message trong N7AI: không đóng khung hộp thô, layout unboxed tinh gọn
              <div className={cn('w-full min-w-0 text-foreground break-words', highlighted && 'ring-2 ring-amber-400 rounded-lg')}>
                {m.deleted ? (
                  <p className="italic text-muted-foreground text-sm">Tin nhắn đã thu hồi</p>
                ) : (
                  <>
                    <AiMessageBody message={m} onAskUserSelect={onAskUserSelect} />
                    {interactive && !m.deleted && (
                      <AssistantActionsBar
                        message={m}
                        onRetry={() => onRetry(m)}
                        onDelete={() => handlers.onDelete(m)}
                      />
                    )}
                  </>
                )}
              </div>
            ) : (
              // User Message & Non-AI Messages
              (hasText || m.deleted || (isAi && !m.attachments)) && (
                <div
                  className={cn(
                    'relative break-words transition-shadow',
                    m.deleted
                      ? 'rounded-2xl px-3.5 py-2 text-sm bg-transparent border border-dashed text-muted-foreground italic'
                      : mine
                        ? isAi
                          ? 'rounded-2xl bg-secondary dark:bg-[#27272a] text-foreground px-4 py-2.5 text-[14px] leading-relaxed shadow-xs whitespace-pre-wrap'
                          : 'rounded-2xl bg-primary text-primary-foreground whitespace-pre-wrap px-3.5 py-2 text-sm'
                        : 'rounded-2xl bg-muted/80 text-foreground whitespace-pre-wrap px-3.5 py-2 text-sm',
                    !m.deleted && (mine ? (continued ? 'rounded-tr-md' : 'rounded-br-md') : continued ? 'rounded-tl-md' : 'rounded-bl-md'),
                    m.status === 'failed' && 'opacity-60',
                    highlighted && 'ring-2 ring-amber-400'
                  )}
                >
                  {mode && !m.deleted && !isAi && (
                    <span
                      className={cn(
                        'mb-1 mr-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
                        mine ? 'text-primary-foreground/80' : 'text-primary'
                      )}
                    >
                      {React.createElement(AI_MODE_META[mode].icon, { className: 'h-3 w-3' })} {AI_MODE_META[mode].label}
                    </span>
                  )}
                  {!m.deleted && <MessageAiBadges meta={m.meta} mine={mine} />}
                  {m.deleted ? (
                    'Tin nhắn đã thu hồi'
                  ) : (
                    <MessageText content={m.content} meta={m.meta} mine={mine} myUsername={myUsername} />
                  )}
                </div>
              )
            )}

            {m.meta?.embeds?.[0] && !m.deleted && <MessageEmbedCard embed={m.meta.embeds[0]} mine={mine} />}
            {!m.deleted && <MessageRefs meta={m.meta} mine={mine} />}
          </div>
          {interactive && !isAi && <MessageActions message={m} mine={mine} visible={actionsOpen} handlers={handlers} />}
        </div>

        {m.reactions.length > 0 && !m.deleted && (
          <div className={cn('flex -mt-1.5 z-10 px-2', mine && 'justify-end')}>
            <button
              onClick={() => setReactionsOpen(true)}
              title="Xem ai đã thả cảm xúc"
              className={cn(
                'h-5 pl-1 pr-1.5 rounded-full text-[11px] flex items-center gap-0.5 border bg-card shadow-xs cursor-pointer hover:bg-muted',
                !!myId && m.reactions.some((r) => r.userIds.includes(myId)) && 'border-primary/50'
              )}
            >
              {m.reactions.slice(0, 3).map((r) => (
                <span key={r.emoji}>{r.emoji}</span>
              ))}
              {reactionCount > 1 && <span className="text-muted-foreground ml-0.5">{reactionCount}</span>}
            </button>
            <ReactionsDialog
              messageId={m.id}
              reactions={m.reactions}
              myId={myId}
              open={reactionsOpen}
              onOpenChange={setReactionsOpen}
              onToggle={(emoji) => handlers.onReact(m, emoji)}
            />
          </div>
        )}

        {/* Ẩn timestamp dưới cùng đối với tin nhắn Assistant vì đã có trạng thái Done · Xs ở trên */}
        {(!isAi || mine) && (
          <span className="text-[10px] text-muted-foreground px-2 mt-0.5 flex items-center gap-1">
            {m.pinnedAt && <Pin className="h-2.5 w-2.5 text-amber-500" />}
            {m.status === 'sending' ? (
              'Đang gửi…'
            ) : m.status === 'failed' ? (
              <button onClick={() => onRetry(m)} className="text-destructive inline-flex items-center gap-1 cursor-pointer">
                <RotateCcw className="h-3 w-3" /> Gửi lỗi · thử lại
              </button>
            ) : (
              <>
                {timeOf(m.createdAt)}
                {m.editedAt && !m.deleted && ' · đã sửa'}
                {seenLabel && ` · ${seenLabel}`}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
