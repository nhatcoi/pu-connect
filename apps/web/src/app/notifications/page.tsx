'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellOff, CheckCheck, Loader2, Settings2 } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { NotificationRow } from '@/components/notifications/notification-row'
import { Switch } from '@/components/ui/switch'
import {
  notificationsApi,
  openNotification,
  useNotificationsStore,
  type NotificationItem
} from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'unread' | 'mentions'

const SETTING_LABELS: Record<string, string> = {
  post_like: 'Lượt thích bài viết',
  post_comment: 'Bình luận vào bài viết của bạn',
  comment_reply: 'Trả lời bình luận của bạn',
  user_mention: 'Nhắc đến bạn (@)',
  user_follow: 'Người theo dõi mới',
  accepted_solution: 'Câu trả lời được chọn làm lời giải'
}

export default function NotificationsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Record<string, boolean> | null>(null)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const liveItems = useNotificationsStore((s) => s.items)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const query = useCallback(
    (before?: string | null) =>
      notificationsApi.list({
        limit: 20,
        before,
        unread: filter === 'unread',
        type: filter === 'mentions' ? 'user_mention' : undefined
      }),
    [filter]
  )

  // Tải trang đầu khi đổi bộ lọc
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    query()
      .then((res) => {
        if (cancelled) return
        setItems(res.data)
        setCursor(res.nextCursor)
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [query])

  // Đồng bộ realtime từ store chung: thông báo mới/gộp + trạng thái đã đọc
  useEffect(() => {
    setItems((prev) => {
      const byId = new Map(liveItems.map((n) => [n.id, n]))
      const fresh = liveItems.filter(
        (n) =>
          !prev.some((p) => p.id === n.id) &&
          (filter === 'all' || (filter === 'unread' && !n.isRead) || (filter === 'mentions' && n.type === 'user_mention')) &&
          (prev.length === 0 || n.updatedAt >= prev[0].updatedAt)
      )
      return [...fresh, ...prev.map((p) => byId.get(p.id) ?? p)]
    })
  }, [liveItems, filter])

  const loadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const res = await query(cursor)
      setItems((prev) => [...prev, ...res.data.filter((n) => !prev.some((p) => p.id === n.id))])
      setCursor(res.nextCursor)
    } finally {
      setIsLoadingMore(false)
    }
  }, [cursor, isLoadingMore, query])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  useEffect(() => {
    if (showSettings && !settings) notificationsApi.getSettings().then((r) => setSettings(r.data)).catch(() => undefined)
  }, [showSettings, settings])

  const toggleSetting = async (key: string, value: boolean) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
    try {
      const res = await notificationsApi.updateSettings({ [key]: value })
      setSettings(res.data)
    } catch {
      setSettings((s) => (s ? { ...s, [key]: !value } : s))
    }
  }

  const markAll = () => {
    useNotificationsStore.getState().markRead('all', 0)
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    notificationsApi.markAllRead().catch(() => undefined)
  }

  const handleClick = (item: NotificationItem) => {
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)))
    openNotification(item, (link) => router.push(link))
  }

  return (
    <AppShell>
      <div className="mx-2 sm:mx-0 rounded-xl bg-card">
        <div className="flex items-center justify-between px-4 pt-4">
          <h1 className="text-lg font-bold">Thông báo</h1>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Đánh dấu đã đọc
              </button>
            )}
            <button
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Cài đặt thông báo"
              className={cn(
                'rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer',
                showSettings && 'bg-muted text-foreground'
              )}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mx-4 mt-3 rounded-xl border border-border/60 p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">Nhận thông báo khi có</p>
            {!settings ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="space-y-2.5">
                {Object.entries(SETTING_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-3 text-[13px] cursor-pointer">
                    <span>{label}</span>
                    <Switch checked={settings[key] !== false} onCheckedChange={(v) => toggleSetting(key, v)} />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <SlidingTabs
          className="px-4 mt-2"
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: 'Tất cả' },
            { id: 'unread', label: 'Chưa đọc' },
            { id: 'mentions', label: 'Nhắc đến' }
          ]}
        />

        <div className="p-2">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <BellOff className="h-8 w-8 opacity-60" />
              <p className="text-sm">
                {filter === 'unread' ? 'Bạn đã đọc hết thông báo' : 'Chưa có thông báo nào'}
              </p>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} onClick={handleClick} />
              ))}
              <div ref={sentinelRef} className="flex justify-center py-4">
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
