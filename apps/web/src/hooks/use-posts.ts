'use client'

import { useCallback } from 'react'
import { useInfiniteQuery, type QueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { queryKeys, type FeedType } from '@/lib/query-keys'
import { flattenPages, type OffsetPage } from '@/lib/post-cache'
import type { PostItem } from '@pu/schemas'

const PAGE_SIZE = 10

interface UsePostsOptions {
  selectedTag?: string | null
  feedType?: FeedType
}

// Trang feed: offset + mốc snapshot (before) ⇒ bài mới không đẩy lệch các trang sau
export interface FeedPageParam {
  offset: number
  before?: string
}

// snapshotAt: mốc server của trang · latestAt: mốc đã chèn bài mới qua pill (trang 0)
export interface FeedMeta {
  snapshotAt?: string
  latestAt?: string
}

export type FeedPage = OffsetPage<PostItem, FeedMeta>

// API trả nhiều dạng (mảng thẳng / { data, total, hasMore } lồng) ⇒ chuẩn hóa về một trang
export function normalizePage(res: any, offset: number): FeedPage {
  let items: PostItem[] = []
  let hasMore = false
  if (Array.isArray(res?.data)) {
    items = res.data
    hasMore = res.hasMore ?? false
  } else if (Array.isArray(res?.data?.data)) {
    items = res.data.data
    hasMore = res.data.hasMore ?? false
  } else if (Array.isArray(res)) {
    items = res
  }
  const snapshotAt: string | undefined = res?.snapshotAt ?? res?.data?.snapshotAt
  return { items, hasMore: hasMore && items.length > 0, nextOffset: offset + items.length, meta: { snapshotAt } }
}

export function feedQueryOptions(feedType: FeedType, tag: string | null) {
  return {
    queryKey: queryKeys.feed(feedType, tag),
    queryFn: async ({ pageParam }: { pageParam: FeedPageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageParam.offset), feedType })
      if (tag) params.set('tag', tag)
      if (pageParam.before) params.set('before', pageParam.before)
      return normalizePage(await apiClient<any>(`/posts?${params.toString()}`), pageParam.offset)
    },
    initialPageParam: { offset: 0 } as FeedPageParam,
    // Trang sau giữ mốc snapshot của trang đầu
    getNextPageParam: (last: FeedPage, pages: FeedPage[], lastParam: FeedPageParam): FeedPageParam | undefined =>
      last.hasMore ? { offset: last.nextOffset, before: lastParam.before ?? pages[0]?.meta?.snapshotAt } : undefined,
    staleTime: 60 * 1000
  }
}

// Tải trước tab feed khác (rê chuột vào tab) ⇒ đổi tab hiện ngay
export function prefetchFeed(queryClient: QueryClient, feedType: FeedType) {
  void queryClient.prefetchInfiniteQuery(feedQueryOptions(feedType, null))
}

// Bảng tin: mỗi (tab, tag) một cache riêng; quay lại /home hoặc đổi tab hiện ngay từ cache
export function usePosts(options?: string | UsePostsOptions | null) {
  const selectedTag = typeof options === 'string' ? options : options?.selectedTag || null
  const feedType: FeedType = typeof options === 'object' && options ? options.feedType || 'for_you' : 'for_you'

  const query = useInfiniteQuery(feedQueryOptions(feedType, selectedTag))
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query

  const fetchMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Mốc cho pill "bài mới": bài > mốc này chưa có trong feed
  const firstMeta = query.data?.pages[0]?.meta
  const newSince = firstMeta?.latestAt ?? firstMeta?.snapshotAt ?? null

  return {
    posts: flattenPages(query.data),
    newSince,
    isLoading: query.isPending,
    isLoadingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    refetch: query.refetch,
    fetchMore
  }
}
