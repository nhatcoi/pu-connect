'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BellOff,
  Eraser,
  Info,
  Maximize2,
  Menu,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  PanelRight,
  Pencil,
  Share2,
  SlidersHorizontal,
  SquarePen,
  Trash2,
} from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  conversationTitle,
  presenceLabel,
  useAiQuota,
  useAiThreadActions,
  useOnlineCount,
  usePresence,
} from '@/hooks/chat'
import { N7AI_HOME } from '@/lib/n7ai-routes'
import { ConversationAvatar } from '../conversation-avatar'
import { OpenInN7AiButton } from '../ai/open-in-n7ai'
import { N7AiPanelButton } from '@/components/n7ai/side-panel/n7ai-side-panel'
import { ShareThreadDialog } from '../ai/share-thread-dialog'
import { AiModelPicker } from '../ai/ai-model-picker'
import { useN7AiLayout } from '@/components/n7ai/layout/n7ai-layout-store'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ThreadHeaderProps {
  conversation: ConversationSummary | undefined
  typingLabel: string | null
  backHref: string
  onInfo: () => void
  onOpenNav?: () => void
  spaceHref?: string
  onAiReset: () => void
}

export function ThreadHeader({
  conversation: conv,
  typingLabel,
  backHref,
  onInfo,
  onOpenNav,
  spaceHref,
  onAiReset,
}: ThreadHeaderProps) {
  const router = useRouter()
  const isAi = conv?.type === 'ai'
  const other = conv?.type === 'direct' ? conv.members[0] : null
  const { data: quota } = useAiQuota(isAi)
  const otherPresence = usePresence(other?.id)
  const onlineInGroup = useOnlineCount(conv?.type === 'group' ? conv.members.map((m) => m.id) : [])
  const [sharing, setSharing] = useState(false)
  const threadActions = useAiThreadActions()
  const panelOpen = useN7AiLayout((s) => s.panelOpen)
  const setPanelOpen = useN7AiLayout((s) => s.setPanelOpen)

  // Header riêng cho N7AI
  if (isAi && conv && !spaceHref) {
    return (
      <div className="shrink-0 z-20 bg-surface/90 backdrop-blur-md px-3 py-2 flex items-center justify-between border-b border-border/40 h-12">
        {/* Left: Breadcrumb Chat / Title */}
        <div className="flex items-center gap-2 min-w-0">
          {onOpenNav && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0 md:hidden text-muted-foreground"
              onClick={onOpenNav}
              aria-label="Lịch sử N7AI"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={N7AI_HOME}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground bg-muted/40 hover:bg-muted/70 transition-colors shrink-0 select-none"
            >
              <MessageSquare size={13} className="shrink-0 text-muted-foreground" />
              <span>Chat</span>
            </Link>
            <span className="text-muted-foreground/40 text-xs font-light select-none">/</span>
            <span className="text-xs font-medium text-muted-foreground hover:text-foreground truncate max-w-[200px] sm:max-w-[400px] select-none transition-colors">
              {conv.title || 'Đoạn chat mới'}
            </span>
          </div>
        </div>

        {/* Right: 4 icons (SlidersHorizontal, NotebookPen, PanelRight, MoreHorizontal) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 1. SlidersHorizontal: Model settings popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Cài đặt mô hình"
                title="Cài đặt mô hình"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
              >
                <SlidersHorizontal size={16} strokeWidth={1.7} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 text-xs space-y-3">
              <p className="font-semibold text-foreground">Cài đặt mô hình</p>
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-[11px]">Mô hình AI:</span>
                <AiModelPicker />
              </div>
              <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                {quota
                  ? `Hạn mức: còn ${Math.max(0, quota.limit - quota.used)}/${quota.limit} lượt hôm nay`
                  : 'Trợ lý học tập N7AI'}
              </div>
            </PopoverContent>
          </Popover>

          {/* 2. NotebookPen: Sổ tay ghi chú / Thư viện */}
          <Link
            href="/n7ai/library"
            title="Sổ tay & học liệu"
            aria-label="Sổ tay & học liệu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
          >
            <NotebookPen size={16} strokeWidth={1.7} />
          </Link>

          {/* 3. PanelRight: Toggle tài liệu & nguồn */}
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            title={panelOpen ? 'Đóng panel tài liệu' : 'Mở panel tài liệu'}
            aria-label="Tài liệu & nguồn"
            aria-pressed={panelOpen}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer',
              panelOpen
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <PanelRight size={16} strokeWidth={1.7} />
          </button>

          {/* 4. MoreHorizontal: Three dots dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Thao tác hội thoại"
                title="Thao tác"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
              >
                <MoreHorizontal size={16} strokeWidth={1.7} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              <DropdownMenuItem
                onClick={() => {
                  const newTitle = window.prompt('Nhập tiêu đề mới cho cuộc trò chuyện:', conv.title || '')
                  if (newTitle && newTitle.trim() && newTitle.trim() !== conv.title) {
                    threadActions.rename.mutate({ id: conv.id, title: newTitle.trim() })
                  }
                }}
                className="gap-2 cursor-pointer"
              >
                <Pencil size={14} />
                <span>Đổi tên</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={onAiReset} className="gap-2 cursor-pointer">
                <Eraser size={14} />
                <span>Chủ đề mới</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setSharing(true)} className="gap-2 cursor-pointer">
                <Share2 size={14} />
                <span>Chia sẻ qua liên kết</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  if (window.confirm('Xóa vĩnh viễn cuộc trò chuyện này? Thao tác không thể hoàn tác.')) {
                    threadActions.remove.mutate(conv.id)
                    router.push(N7AI_HOME)
                  }
                }}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Xóa cuộc trò chuyện</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {sharing && <ShareThreadDialog threadId={conv.id} open onOpenChange={setSharing} />}
        </div>
      </div>
    )
  }

  // Header dành cho DM / Nhóm hoặc Chat nhanh trong Tin nhắn
  const isOnline = !isAi && other && conv?.blockState === 'none' && otherPresence?.online

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
    <div className="@container shrink-0 z-20 bg-surface/90 backdrop-blur-md px-3 py-2.5 flex items-center gap-2.5 border-b border-border/40">
      {onOpenNav ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 md:hidden" onClick={onOpenNav} aria-label="Lịch sử N7AI">
          <Menu className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 rounded-full shrink-0', backHref === '/messages' && 'md:hidden')}
          onClick={() => router.push(backHref)}
          aria-label="Quay lại"
        >
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
            <p className="text-sm font-semibold truncate">{isAi && conv.title ? conv.title : conversationTitle(conv)}</p>
          )}
          {conv?.mutedUntil && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        <div className="text-[11px] truncate">
          {typingLabel ? (
            <span className="text-primary font-medium animate-pulse">{typingLabel}</span>
          ) : isOnline ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Đang hoạt động
            </span>
          ) : (
            <span className="text-muted-foreground">{subtitle}</span>
          )}
        </div>
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
          <>
            <Button asChild variant="ghost" size="sm" className="h-8 rounded-full gap-1.5 text-xs" title="Cuộc trò chuyện mới">
              <Link href={N7AI_HOME}>
                <SquarePen className="h-3.5 w-3.5" /> <span className="hidden @lg:inline">Chat mới</span>
              </Link>
            </Button>
            <N7AiPanelButton />
          </>
        ))}
      {conv && (!isAi || spaceHref) && (
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={onInfo} aria-label="Thông tin hội thoại">
          <Info className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
