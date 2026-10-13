'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

// Lượt hỏi PU AI còn lại hôm nay (tự làm mới khi AI trả lời xong)
export function useAiQuota(enabled = true) {
  return useQuery({ queryKey: queryKeys.aiQuota, queryFn: chatApi.aiQuota, enabled, staleTime: 60 * 1000 })
}
