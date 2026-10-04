'use client'

import React from 'react'
import { AtSign, Award, BadgeCheck, Heart, MessageSquare, Reply, Sparkles, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PuMark } from '@/components/brand/pu-logo'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { NotificationItem, NotificationType } from '@/hooks/use-notifications'

// Icon nhỏ góc avatar theo loại thông báo
const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  post_like: <Heart className="h-3 w-3 text-rose-500 fill-rose-500/30" />,
  post_comment: <MessageSquare className="h-3 w-3 text-primary" />,
  comment_reply: <Reply className="h-3 w-3 text-primary" />,
  user_mention: <AtSign className="h-3 w-3 text-brand-orange" />,
  user_follow: <UserPlus className="h-3 w-3 text-emerald-600" />,
  accepted_solution: <Award className="h-3 w-3 text-amber-500 fill-amber-500/30" />,
  account_verified: <BadgeCheck className="h-3 w-3 text-primary" />,
  ai_reply: <Sparkles className="h-3 w-3 text-primary" />
}

interface NotificationRowProps {
  item: NotificationItem
  onClick: (item: NotificationItem) => void
  compact?: boolean
}

export function NotificationRow({ item, onClick, compact }: NotificationRowProps) {
  const initials = (item.actor?.displayName || 'PU').slice(0, 2).toUpperCase()

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors hover:bg-muted/50 cursor-pointer',
        compact ? 'px-3 py-2.5' : 'px-4 py-3 rounded-xl',
        !item.isRead && 'bg-primary/[0.05]'
      )}
    >
      <div className="relative shrink-0">
        {item.actor ? (
          <Avatar className={compact ? 'h-8 w-8' : 'h-10 w-10'}>
            <AvatarImage src={item.actor.avatarUrl || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
        ) : (
          // Thông báo hệ thống (không có actor)
          <PuMark className={cn('rounded-full', compact ? 'h-8 w-8' : 'h-10 w-10')} />
        )}
        <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-[3px] shadow-sm">
          {TYPE_ICON[item.type] ?? <Sparkles className="h-3 w-3 text-primary" />}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('leading-snug text-foreground', compact ? 'text-xs' : 'text-[13px]', !item.isRead && 'font-semibold')}>
          {item.title}
        </p>
        {item.message && (
          <p className={cn('mt-0.5 line-clamp-2 text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
            {item.message}
          </p>
        )}
        <p className="mt-1 text-[10px] font-medium text-muted-foreground">{formatRelativeTime(item.updatedAt)}</p>
      </div>

      {!item.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-orange" aria-label="Chưa đọc" />}
    </button>
  )
}
