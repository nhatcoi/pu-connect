'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PostItem } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { findCachedPost } from '@/lib/post-cache'

// Cache ['post', id]; bài đã có trong feed/cộng đồng thì hiện ngay (initialData) rồi làm mới ngầm — dùng chung trang chi tiết & modal
export function usePostDetail(id: string) {
  const queryClient = useQueryClient()
  const { data: post, isPending, isError } = useQuery({
    queryKey: queryKeys.post(id),
    queryFn: async () => (await apiClient<{ success: boolean; data: PostItem }>(`/posts/${id}`)).data,
    initialData: () => findCachedPost(queryClient, id),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 1000,
    enabled: !!id
  })
  const status = isPending ? 'loading' : isError || !post ? 'missing' : 'ready'
  return { post, status } as const
}
