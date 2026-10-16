'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useRouter } from 'next/navigation'
import { BellOff, CheckCheck, Loader2, Settings2 } from 'lucide-react'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { NotificationRow } from '@/components/notifications/notification-row'
import { NotificationSettingsPanel } from '@/components/notifications/notification-settings-panel'
import { notificationsApi, openNotification, useNotificationsStore, type NotificationItem } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { NotificationListSkeleton } from '@/components/skeletons/notification-skeleton'

type Filter = 'all' | 'unread' | 'mentions'

export default function NotificationsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const queryClient = useQueryClient()
  const [showSettings, setShowSettings] = useState(false)
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const liveItems = useNotificationsStore((s) => s.items)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Mỗi bộ lọc một cache (cursor-based): quay lại trang / đổi tab hiện ngay
  const query = useInfiniteQuery({
    queryKey: queryKeys.notifications(filter),
    queryFn: ({ pageParam }) =>
      notificationsApi.list({
        limit: 20,
        before: pageParam,
        unread: filter === 'unread',
        type: filter === 'mentions' ? 'user_mention' : undefined
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30 * 1000
  })
  const isLoading = query.isPending
  const isLoadingMore = query.isFetchingNextPage

  // Trộn realtime từ store chung: thông báo mới/gộp lên đầu + trạng thái đã đọc mới nhất
  const items = useMemo(() => {
    const list = query.data?.pages.flatMap((p) => p.data) ?? []
    const byId = new Map(liveItems.map((n) => [n.id, n]))
    const seen = new Set(list.map((n) => n.id))
    const fresh = liveItems.filter(
      (n) =>
        !seen.has(n.id) &&
        (filter === 'all' || (filter === 'unread' && !n.isRead) || (filter === 'mentions' && n.type === 'user_mention')) &&
        (list.length === 0 || n.updatedAt >= list[0].updatedAt)
    )
    return [...fresh, ...list.map((n) => byId.get(n.id) ?? n)]
  }, [query.data, liveItems, filter])

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  // Đánh dấu đã đọc trong mọi danh sách thông báo đã cache
  const markReadInCache = (predicate: (n: NotificationItem) => boolean) => {
    queryClient.setQueriesData<InfiniteData<{ data: NotificationItem[]; nextCursor: string | null }>>({ queryKey: ['notifications'] }, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({ ...p, data: p.data.map((n) => (predicate(n) ? { ...n, isRead: true } : n)) }))
          }
        : old
    )
  }

  const markAll = () => {
    useNotificationsStore.getState().markRead('all', 0)
    markReadInCache(() => true)
    notificationsApi.markAllRead().catch(() => undefined)
  }

  const handleClick = (item: NotificationItem) => {
    markReadInCache((n) => n.id === item.id)
    openNotification(item, (link) => router.push(link))
  }

  return (
    <div className="pt-3">
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
            <NotificationSettingsPanel />
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
            <NotificationListSkeleton />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <BellOff className="h-8 w-8 opacity-60" />
              <p className="text-sm">{filter === 'unread' ? 'Bạn đã đọc hết thông báo' : 'Chưa có thông báo nào'}</p>
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
    </div>
  )
}
