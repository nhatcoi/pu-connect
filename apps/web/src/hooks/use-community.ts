'use client'

import { useCallback, useEffect, useState } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { apiClient, errorMessage } from '@/lib/api-client'
import { queryKeys, type CommunitySort } from '@/lib/query-keys'
import { flattenPages, prependPost, type OffsetPage } from '@/lib/post-cache'
import type { Community, PostItem } from '@pu/schemas'
import { toast } from 'sonner'

type CommunityPage = OffsetPage<PostItem, Community>

async function fetchCommunityPage(slug: string, sort: CommunitySort, offset: number): Promise<CommunityPage> {
  const res = await apiClient<{ success: boolean; data: PostItem[]; community: Community; hasMore: boolean; nextOffset: number }>(
    `/communities/${slug}/posts?limit=10&offset=${offset}&sort=${sort}`
  )
  return { items: res.data, hasMore: res.hasMore, nextOffset: res.nextOffset, meta: res.community }
}

export function communityQueryOptions(slug: string, sort: CommunitySort) {
  return {
    queryKey: queryKeys.community(slug, sort),
    queryFn: ({ pageParam }: { pageParam: number }) => fetchCommunityPage(slug, sort, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last: CommunityPage) => (last.hasMore ? last.nextOffset : undefined),
    staleTime: 2 * 60 * 1000
  }
}

// Tải trước khi rê chuột vào link cộng đồng
export function prefetchCommunity(queryClient: QueryClient, slug: string) {
  void queryClient.prefetchInfiniteQuery(communityQueryOptions(slug, 'hot'))
}

// Cập nhật thông tin cộng đồng ở mọi kiểu sắp xếp đã cache + danh sách cộng đồng
function patchCommunity(qc: QueryClient, slug: string, patch: (c: Community) => Community) {
  qc.setQueriesData<InfiniteData<CommunityPage>>({ queryKey: queryKeys.communityAll(slug) }, (old) =>
    old ? { ...old, pages: old.pages.map((p) => (p.meta ? { ...p, meta: patch(p.meta) } : p)) } : old
  )
  qc.setQueriesData<Community[]>({ queryKey: queryKeys.communities }, (old) => old?.map((c) => (c.slug === slug ? patch(c) : c)))
}

export function useCommunity(slug: string, initialSort: CommunitySort = 'hot') {
  const queryClient = useQueryClient()
  const [sort, setSort] = useState<CommunitySort>(initialSort)
  const [isJoining, setIsJoining] = useState(false)

  // Mỗi kiểu sắp xếp một cache riêng ⇒ đổi tab Hot/Mới/Top tức thì khi đã xem
  const query = useInfiniteQuery({ ...communityQueryOptions(slug, sort), enabled: !!slug })

  const community = query.data?.pages[0]?.meta ?? null
  const posts = flattenPages(query.data)

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const fetchMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const toggleJoin = useCallback(async () => {
    if (!community || isJoining) return
    setIsJoining(true)
    try {
      const res = await apiClient<{ isMember: boolean; membersCount: number; message: string }>(`/communities/${slug}/join`, { method: 'POST' })
      patchCommunity(queryClient, slug, (c) => ({ ...c, isMember: res.isMember, membersCount: res.membersCount }))
      toast.success(res.message)
    } catch (err) {
      toast.error(errorMessage(err, 'Thao tác không thành công'))
    } finally {
      setIsJoining(false)
    }
  }, [community, isJoining, slug, queryClient])

  // Bài mới đăng trong cộng đồng: chèn lên đầu mọi kiểu sắp xếp + tăng bộ đếm
  const addPost = useCallback(
    (newPost: PostItem) => {
      prependPost(queryClient, queryKeys.communityAll(slug), newPost)
      patchCommunity(queryClient, slug, (c) => ({ ...c, postsCount: (c.postsCount || 0) + 1 }))
    },
    [queryClient, slug]
  )

  // Lỗi tải lần đầu: báo một lần
  const loadError = query.isError && !query.data ? query.error?.message || 'Không thể tải thông tin cộng đồng' : null
  useEffect(() => {
    if (loadError) toast.error(loadError, { id: `community-${slug}` })
  }, [loadError, slug])

  return {
    community,
    posts,
    sort,
    setSort,
    isLoading: query.isPending,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: !!query.hasNextPage,
    fetchMore,
    toggleJoin,
    isJoining,
    addPost,
    refresh: query.refetch
  }
}
