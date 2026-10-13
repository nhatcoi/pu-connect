'use client'

import { useQuery } from '@tanstack/react-query'
import type { PostSummary } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

// Tóm tắt bài bằng PU AI: chỉ gọi khi người dùng bấm; server lưu sẵn theo nội dung ⇒ không cần tải lại
export function usePostSummary(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.postSummary(postId),
    queryFn: async () => (await apiClient<{ success: boolean; data: PostSummary }>(`/posts/${postId}/summary`, { method: 'POST' })).data,
    enabled,
    staleTime: Infinity,
    retry: false
  })
}
