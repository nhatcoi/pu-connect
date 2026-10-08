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

// API trả nhiều dạng (mảng thẳng / { data, total, hasMore } lồng) ⇒ chuẩn hóa về một trang
function normalizePage(res: any, offset: number): OffsetPage<PostItem> {
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
  return { items, hasMore: hasMore && items.length > 0, nextOffset: offset + items.length }
}

export function feedQueryOptions(feedType: FeedType, tag: string | null) {
  return {
    queryKey: queryKeys.feed(feedType, tag),
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageParam), feedType })
      if (tag) params.set('tag', tag)
      return normalizePage(await apiClient<any>(`/posts?${params.toString()}`), pageParam)
    },
    initialPageParam: 0,
    getNextPageParam: (last: OffsetPage<PostItem>) => (last.hasMore ? last.nextOffset : undefined),
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

  return {
    posts: flattenPages(query.data),
    isLoading: query.isPending,
    isLoadingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    refetch: query.refetch,
    fetchMore
  }
}
