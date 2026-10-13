'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { NotificationRow } from '@/components/notifications/notification-row'
import { NotificationListSkeleton } from '@/components/skeletons/notification-skeleton'
import {
  notificationsApi,
  openNotification,
  useNotificationsStore,
  useNotificationsSync,
  type NotificationItem
} from '@/hooks/use-notifications'

export function NotificationsPopover() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const items = useNotificationsStore((s) => s.items)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const loaded = useNotificationsStore((s) => s.loaded)

  // Tải + realtime + toast (chỉ gắn một lần ở Header)
  useNotificationsSync((link) => router.push(link))

  const handleMarkAllAsRead = async () => {
    useNotificationsStore.getState().markRead('all', 0)
    notificationsApi.markAllRead().catch(() => undefined)
  }

  const handleItemClick = (item: NotificationItem) => {
    setOpen(false)
    openNotification(item, (link) => router.push(link))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-lg border-border/80 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
          <span className="text-sm font-semibold">Thông báo</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Đánh dấu đã đọc</span>
            </button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {!loaded ? (
            <NotificationListSkeleton count={4} compact />
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Chưa có thông báo nào</div>
          ) : (
            items.slice(0, 10).map((item) => (
              <NotificationRow key={item.id} item={item} onClick={handleItemClick} compact />
            ))
          )}
        </div>

        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-border/60 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted/40"
        >
          Xem tất cả thông báo
        </Link>
      </PopoverContent>
    </Popover>
  )
}
