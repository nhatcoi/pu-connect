'use client'

import { useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { ProfileActivityType } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { flattenPages } from '@/lib/post-cache'
import { queryKeys } from '@/lib/query-keys'
import { normalizePage, type FeedPage, type FeedPageParam, type RawFeedResponse } from './use-posts'

const PAGE_SIZE = 10

// Tab hoạt động trên hồ sơ: bài đã thích / đã lưu / đã bình luận (phân trang offset + snapshot)
export function useProfileActivity(username: string, type: ProfileActivityType, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.profileActivity(username, type),
    queryFn: async ({ pageParam }: { pageParam: FeedPageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageParam.offset) })
      if (pageParam.before) params.set('before', pageParam.before)
      const raw = await apiClient<RawFeedResponse>(
        `/users/${encodeURIComponent(username)}/activity/${type}?${params.toString()}`
      )
      return normalizePage(raw, pageParam.offset)
    },
    initialPageParam: { offset: 0 } as FeedPageParam,
    getNextPageParam: (last: FeedPage, pages: FeedPage[], lastParam: FeedPageParam): FeedPageParam | undefined =>
      last.hasMore ? { offset: last.nextOffset, before: lastParam.before ?? pages[0]?.meta?.snapshotAt } : undefined,
    enabled: enabled && !!username,
    staleTime: 60 * 1000
  })

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const fetchMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return {
    posts: flattenPages(query.data),
    isLoading: query.isPending,
    isError: query.isError,
    isLoadingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    fetchMore
  }
}
