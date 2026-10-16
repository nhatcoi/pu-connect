'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { queryKeys, type FeedType } from '@/lib/query-keys'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'
import { normalizePage, type FeedPage, type RawFeedResponse } from '@/hooks/use-posts'

export interface NewPostsAuthor {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

interface NewPostsSummary {
  count: number
  authors: NewPostsAuthor[]
}

const POLL_MS = 60_000
// Gộp nhiều tín hiệu socket liền nhau thành 1 lần đếm
const SIGNAL_DEBOUNCE_MS = 3_000
// Số bài mới tối đa chèn mỗi lần bấm pill
const REVEAL_LIMIT = 50

// Pill "bài mới" kiểu X: polling 60s + khi quay lại tab + tín hiệu socket (feed:new_post)
// New-posts pill: poll, refetch on focus, socket hint; reveal prepends without reloading the feed
export function useNewPosts(feedType: FeedType, tag: string | null, since: string | null) {
  const queryClient = useQueryClient()
  const [isRevealing, setIsRevealing] = useState(false)

  const query = useQuery({
    queryKey: ['feed-new', feedType, tag, since] as const,
    queryFn: async (): Promise<NewPostsSummary> => {
      const params = new URLSearchParams({ feedType, since: since! })
      if (tag) params.set('tag', tag)
      const res = await apiClient<{ data?: NewPostsSummary }>(`/posts/new-since?${params.toString()}`)
      return { count: res?.data?.count ?? 0, authors: res?.data?.authors ?? [] }
    },
    enabled: !!since,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000
  })

  // Socket chỉ là tín hiệu; số thật lấy từ /posts/new-since
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useRealtimeEvent('feed:new_post', () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['feed-new', feedType, tag] })
    }, SIGNAL_DEBOUNCE_MS)
  })
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  // Chèn bài mới lên đầu trang 0 (giữ các bài đã tải), dời mốc pill, cuộn lên đầu
  const reveal = useCallback(async () => {
    if (!since || isRevealing) return
    setIsRevealing(true)
    try {
      const params = new URLSearchParams({ limit: String(REVEAL_LIMIT), offset: '0', feedType, after: since })
      if (tag) params.set('tag', tag)
      const page = normalizePage(await apiClient<RawFeedResponse>(`/posts?${params.toString()}`), 0)

      queryClient.setQueryData<InfiniteData<FeedPage>>(queryKeys.feed(feedType, tag), (old) => {
        if (!old?.pages?.length) return old
        const [first, ...rest] = old.pages
        const loaded = new Set(first.items.map((p) => p.id))
        const fresh = page.items.filter((p) => !loaded.has(p.id))
        return {
          ...old,
          pages: [
            { ...first, items: [...fresh, ...first.items], meta: { ...first.meta, latestAt: page.meta?.snapshotAt ?? since } },
            ...rest
          ]
        }
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIsRevealing(false)
    }
  }, [feedType, tag, since, isRevealing, queryClient])

  return {
    count: query.data?.count ?? 0,
    authors: query.data?.authors ?? [],
    isRevealing,
    reveal
  }
}
