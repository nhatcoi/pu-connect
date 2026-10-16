'use client'

import React from 'react'
import Link from 'next/link'
import { AtSign, BellOff, Pin } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { conversationTitle } from '@/hooks/chat'
import { cn, formatRelativeTime } from '@/lib/utils'
import { ConversationAvatar } from './conversation-avatar'
import { messagePreview } from './utils'

// 1 dòng trong danh sách hội thoại: tên, xem trước tin cuối, giờ, ghim / tắt tiếng / chưa đọc
export function ConversationItem({ conversation: c, myId }: { conversation: ConversationSummary; myId?: string }) {
  const last = c.lastMessage
  const unread = c.unreadCount > 0
  const muted = !!c.mutedUntil
  const prefix =
    !last || last.kind === 'system' || last.deleted
      ? ''
      : last.sender?.id === myId
        ? 'Bạn: '
        : c.type === 'group' && last.sender
          ? `${last.sender.displayName}: `
          : ''
  const preview = !last ? (c.type === 'ai' ? 'Giải thích, quiz, flashcard, lộ trình ôn…' : 'Bắt đầu cuộc trò chuyện') : `${prefix}${messagePreview(last)}`

  return (
    <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
      <ConversationAvatar conversation={c} className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-sm truncate flex-1', unread ? 'font-bold' : 'font-medium')}>{conversationTitle(c)}</p>
          {c.pinnedAt && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
          {muted && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
          {c.lastMessageAt && <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeTime(c.lastMessageAt)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <p className={cn('text-xs truncate flex-1', unread ? 'text-foreground font-medium' : 'text-muted-foreground')}>{preview}</p>
          {c.unreadMentions > 0 && (
            <span
              className="h-5 w-5 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shrink-0"
              title={`${c.unreadMentions} tin nhắc đến bạn`}
            >
              <AtSign className="h-3 w-3" />
            </span>
          )}
          {unread && (
            <span
              className={cn(
                'min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                muted ? 'bg-muted text-muted-foreground' : 'bg-brand-orange text-white'
              )}
            >
              {c.unreadCount > 99 ? '99+' : c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
