'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  Heart,
  MessageSquare,
  Award,
  AtSign,
  Users,
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { apiClient } from '@/lib/api-client'
import { formatRelativeTime, cn } from '@/lib/utils'

export interface NotificationItem {
  id: string
  recipientId: string
  actorId: string | null
  actor?: {
    id: string
    username: string
    displayName: string
    avatarUrl?: string | null
  } | null
  type: string
  title: string
  message: string
  entityId?: string | null
  entityType?: string | null
  isRead: boolean
  createdAt: string
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'post_like':
      return <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500/20" />
    case 'post_comment':
    case 'comment_reply':
      return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
    case 'accepted_solution':
      return <Award className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
    case 'user_mention':
      return <AtSign className="h-3.5 w-3.5 text-purple-500" />
    case 'group_join_request':
    case 'group_member_accepted':
      return <Users className="h-3.5 w-3.5 text-emerald-500" />
    case 'course_document_uploaded':
      return <FileText className="h-3.5 w-3.5 text-sky-500" />
    default:
      return <Sparkles className="h-3.5 w-3.5 text-primary" />
  }
}

export function NotificationsPopover() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await apiClient<{
        success: boolean
        data: NotificationItem[]
        unreadCount: number
      }>('/notifications?limit=15')

      if (res && res.data) {
        setNotifications(res.data)
        setUnreadCount(res.unreadCount || 0)
      }
    } catch {
      // Mock fallback if user is guest or initial load
      setNotifications([
        {
          id: 'mock-1',
          recipientId: 'current',
          actorId: 'mock-u1',
          actor: {
            id: 'mock-u1',
            username: 'gv_nguyenvanha',
            displayName: 'TS. Nguyễn Văn Hà',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GVHa'
          },
          type: 'accepted_solution',
          title: 'Lời giải chính xác',
          message: 'đã chọn câu trả lời của bạn là Lời giải chính xác (+25 điểm danh vọng).',
          entityId: '05a1f0c4-6324-4fa6-a5e1-d1740ed4bf73',
          entityType: 'post',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
        },
        {
          id: 'mock-2',
          recipientId: 'current',
          actorId: 'mock-u2',
          actor: {
            id: 'mock-u2',
            username: 'tranthimai',
            displayName: 'Trần Thị Mai',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mai'
          },
          type: 'post_like',
          title: 'Lượt thích mới',
          message: 'và 3 người khác đã thích bài viết giải bài tập Cấu trúc dữ liệu của bạn.',
          entityId: '28dba253-c0c7-49ef-aff8-1e7c02f58553',
          entityType: 'post',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString()
        },
        {
          id: 'mock-3',
          recipientId: 'current',
          actorId: 'mock-u3',
          actor: {
            id: 'mock-u3',
            username: 'lequangdung',
            displayName: 'Lê Quang Dũng',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dung'
          },
          type: 'group_join_request',
          title: 'Xin gia nhập nhóm',
          message: 'muốn tham gia nhóm đồ án PBL Smart Campus K16.',
          entityId: 'groups',
          entityType: 'study_group',
          isRead: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString()
        }
      ])
      setUnreadCount(2)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Poll every 45s for fresh notifications
    const interval = setInterval(fetchNotifications, 45000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient('/notifications/read-all', { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    }
  }

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        await apiClient(`/notifications/${notif.id}/read`, { method: 'PATCH' })
      } catch {}
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }

    setOpen(false)
    if (notif.entityType === 'study_group') {
      router.push('/groups')
    } else if (notif.entityId) {
      router.push(`/?post=${notif.entityId}`)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground shadow-sm animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-lg border-border/80">
        <div className="flex items-center justify-between border-b border-border/70 p-3 bg-muted/20">
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <Bell className="h-4 w-4 text-primary" />
            <span>Thông báo</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.2 text-[11px] font-semibold text-primary">
                {unreadCount} mới
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Đã đọc tất cả</span>
            </button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Chưa có thông báo nào
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={cn(
                  'flex items-start gap-3 p-3 transition-colors hover:bg-muted/40 cursor-pointer text-left',
                  !item.isRead && 'bg-primary/[0.04]'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={item.actor?.avatarUrl || ''} />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {item.actor?.displayName?.slice(0, 2).toUpperCase() || 'PU'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5 shadow-sm">
                    {getNotificationIcon(item.type)}
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs leading-snug text-foreground">
                    <span className="font-semibold text-foreground">
                      {item.actor?.displayName || 'Thành viên Phenikaa'}{' '}
                    </span>
                    <span className="text-muted-foreground">{item.message}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>

                {!item.isRead && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
