'use client'

import { useCallback } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { Course, CourseOverview, DocumentItem, PostItem, StudyGroup } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { flattenPages, type OffsetPage } from '@/lib/post-cache'

type Envelope<T> = { success: boolean; data: T }

// Danh mục học phần
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.courses,
    queryFn: async () => (await apiClient<Envelope<Course[]>>('/courses')).data,
    staleTime: 10 * 60 * 1000
  })
}

// Trang học phần: tổng quan + bài viết (phân trang) + tài liệu + nhóm học
export function useCourse(code: string) {
  const queryClient = useQueryClient()
  const key = code.toUpperCase()

  const overview = useQuery({
    queryKey: queryKeys.course(key),
    queryFn: async () => (await apiClient<Envelope<CourseOverview>>(`/courses/${encodeURIComponent(key)}/overview`)).data,
    staleTime: 2 * 60 * 1000,
    retry: (count, err: any) => err?.status !== 404 && count < 2
  })

  const posts = useInfiniteQuery({
    queryKey: queryKeys.coursePosts(key),
    queryFn: async ({ pageParam }): Promise<OffsetPage<PostItem>> => {
      const res = await apiClient<{ data: PostItem[]; hasMore: boolean; nextOffset: number }>(
        `/posts?course=${encodeURIComponent(key)}&limit=10&offset=${pageParam}`
      )
      return { items: res.data, hasMore: res.hasMore, nextOffset: res.nextOffset }
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    staleTime: 60 * 1000,
    enabled: overview.isSuccess
  })

  const documents = useQuery({
    queryKey: queryKeys.courseDocuments(key),
    queryFn: async () => (await apiClient<Envelope<DocumentItem[]>>(`/documents?course=${encodeURIComponent(key)}`)).data,
    staleTime: 2 * 60 * 1000,
    enabled: overview.isSuccess
  })

  const groups = useQuery({
    queryKey: queryKeys.courseGroups(key),
    queryFn: async () => (await apiClient<Envelope<StudyGroup[]>>(`/study-groups?course=${encodeURIComponent(key)}`)).data,
    staleTime: 60 * 1000,
    enabled: overview.isSuccess
  })

  // Bài mới đăng từ trang học phần ⇒ chèn lên đầu danh sách
  const addPost = useCallback(
    (post: PostItem) => {
      queryClient.setQueryData<InfiniteData<OffsetPage<PostItem>>>(queryKeys.coursePosts(key), (old) =>
        old && old.pages.length
          ? { ...old, pages: [{ ...old.pages[0], items: [post, ...old.pages[0].items] }, ...old.pages.slice(1)] }
          : old
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.course(key) })
    },
    [queryClient, key]
  )

  const joinGroup = useCallback(
    async (groupId: string) => {
      const res = await apiClient<Envelope<StudyGroup>>(`/study-groups/${groupId}/join`, { method: 'POST' })
      queryClient.setQueryData<StudyGroup[]>(queryKeys.courseGroups(key), (old) =>
        old?.map((g) => (g.id === groupId ? res.data : g))
      )
      return res.data
    },
    [queryClient, key]
  )

  return {
    overview: overview.data ?? null,
    isLoading: overview.isPending,
    notFound: (overview.error as any)?.status === 404,
    posts: flattenPages(posts.data),
    postsLoading: posts.isPending,
    hasMorePosts: !!posts.hasNextPage,
    isLoadingMorePosts: posts.isFetchingNextPage,
    fetchMorePosts: () => {
      if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage()
    },
    documents: documents.data ?? [],
    documentsLoading: documents.isPending,
    groups: groups.data ?? [],
    groupsLoading: groups.isPending,
    addPost,
    joinGroup
  }
}
