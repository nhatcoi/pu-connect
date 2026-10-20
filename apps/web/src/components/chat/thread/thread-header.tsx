'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BellOff, Eraser, Info, Maximize2, Menu, Share2, SquarePen } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { conversationTitle, presenceLabel, useAiQuota, useOnlineCount, usePresence } from '@/hooks/chat'
import { N7AI_HOME } from '@/lib/n7ai-routes'
import { ConversationAvatar } from '../conversation-avatar'
import { OpenInN7AiButton } from '../ai/open-in-n7ai'
import { ShareThreadDialog } from '../ai/share-thread-dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface ThreadHeaderProps {
  conversation: ConversationSummary | undefined
  typingLabel: string | null
  backHref: string
  onInfo: () => void
  // Không gian N7AI (mobile): mở ngăn lịch sử thay cho nút quay lại
  onOpenNav?: () => void
  // Thread N7AI chat nhanh (Tin nhắn): mở trong không gian /n7ai thay cho "Chat mới"
  spaceHref?: string
  onAiReset: () => void
}

// Đầu hội thoại: quay lại / mở lịch sử, tên + trạng thái (đang nhập / hoạt động / lượt AI / số thành viên), thông tin
export function ThreadHeader({ conversation: conv, typingLabel, backHref, onInfo, onOpenNav, spaceHref, onAiReset }: ThreadHeaderProps) {
  const router = useRouter()
  const isAi = conv?.type === 'ai'
  const other = conv?.type === 'direct' ? conv.members[0] : null
  const { data: quota } = useAiQuota(isAi)
  const otherPresence = usePresence(other?.id)
  const onlineInGroup = useOnlineCount(conv?.type === 'group' ? conv.members.map((m) => m.id) : [])
  const [sharing, setSharing] = React.useState(false)

  const subtitle =
    typingLabel ??
    (isAi
      ? quota
        ? `Trợ lý học tập · còn ${Math.max(0, quota.limit - quota.used)}/${quota.limit} lượt hôm nay`
        : 'Trợ lý học tập'
      : conv?.type === 'group'
        ? `${conv.memberCount} thành viên${onlineInGroup ? ` · ${onlineInGroup} đang hoạt động` : ''}`
        : other
          ? (conv?.blockState === 'none' && presenceLabel(otherPresence)) || `@${other.username}`
          : '')

  return (
    <div className="sticky top-0 md:top-[var(--app-header-height,3.5rem)] z-30 bg-surface/90 backdrop-blur-md px-3 py-2.5 flex items-center gap-2.5">
      {onOpenNav ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 md:hidden" onClick={onOpenNav} aria-label="Lịch sử N7AI">
          <Menu className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => router.push(backHref)} aria-label="Quay lại">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
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
            // Thread N7AI: hiện tiêu đề cuộc trò chuyện
            <p className="text-sm font-semibold truncate">{isAi && conv.title ? conv.title : conversationTitle(conv)}</p>
          )}
          {conv?.mutedUntil && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        <p className={`text-[11px] truncate ${typingLabel ? 'text-primary' : 'text-muted-foreground'}`}>{subtitle}</p>
      </div>
      {isAi && <OpenInN7AiButton />}
      {isAi && conv.lastMessage && (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => setSharing(true)} title="Chia sẻ qua link" aria-label="Chia sẻ">
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      )}
      {isAi && sharing && <ShareThreadDialog threadId={conv.id} open onOpenChange={setSharing} />}
      {isAi && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0"
          onClick={onAiReset}
          title="Chủ đề mới — N7AI quên các tin phía trên"
          aria-label="Chủ đề mới"
        >
          <Eraser className="h-3.5 w-3.5" />
        </Button>
      )}
      {isAi &&
        (spaceHref ? (
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" title="Mở trong không gian N7AI">
            <Link href={spaceHref} aria-label="Mở trong không gian N7AI">
              <Maximize2 className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-full gap-1.5 text-xs" title="Cuộc trò chuyện mới">
            <Link href={N7AI_HOME}>
              <SquarePen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Chat mới</span>
            </Link>
          </Button>
        ))}
      {conv && (!isAi || spaceHref) && (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 lg:hidden" onClick={onInfo} aria-label="Thông tin hội thoại">
          <Info className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
