'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BellOff, Eraser, Info } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { conversationTitle, useAiQuota } from '@/hooks/chat'
import { ConversationAvatar } from '../conversation-avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface ThreadHeaderProps {
  conversation: ConversationSummary | undefined
  typingLabel: string | null
  onInfo: () => void
  onAiReset: () => void
}

// Đầu hội thoại: quay lại, tên + trạng thái (đang nhập / lượt AI / số thành viên), thông tin
export function ThreadHeader({ conversation: conv, typingLabel, onInfo, onAiReset }: ThreadHeaderProps) {
  const router = useRouter()
  const isAi = conv?.type === 'ai'
  const other = conv?.type === 'direct' ? conv.members[0] : null
  const { data: quota } = useAiQuota(isAi)

  const subtitle =
    typingLabel ??
    (isAi
      ? quota
        ? `Trợ lý học tập · còn ${Math.max(0, quota.limit - quota.used)}/${quota.limit} lượt hôm nay`
        : 'Trợ lý học tập'
      : conv?.type === 'group'
        ? `${conv.memberCount} thành viên`
        : other
          ? `@${other.username}`
          : '')

  return (
    <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-3 py-2.5 flex items-center gap-2.5">
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => router.push('/messages')} aria-label="Về tin nhắn">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      {conv ? <ConversationAvatar conversation={conv} className="h-9 w-9" /> : <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {!conv ? (
            <Skeleton className="h-4 w-32 my-0.5" />
          ) : other ? (
            <Link href={`/${other.username}`} className="text-sm font-semibold truncate hover:underline">
              {conversationTitle(conv)}
            </Link>
          ) : (
            <p className="text-sm font-semibold truncate">{conversationTitle(conv)}</p>
          )}
          {conv?.mutedUntil && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        <p className={`text-[11px] truncate ${typingLabel ? 'text-primary' : 'text-muted-foreground'}`}>{subtitle}</p>
      </div>
      {isAi && (
        <Button variant="ghost" size="sm" className="h-8 rounded-full gap-1.5 text-xs" onClick={onAiReset} title="PU AI quên các tin phía trên">
          <Eraser className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Chủ đề mới</span>
        </Button>
      )}
      {conv && (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 lg:hidden" onClick={onInfo} aria-label="Thông tin hội thoại">
          <Info className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
