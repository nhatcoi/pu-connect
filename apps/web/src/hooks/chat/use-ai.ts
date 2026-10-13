'use client'

import { useQuery } from '@tanstack/react-query'
import type { AiMode, AiSuggestion } from '@pu/schemas'
import { track } from '@/lib/track'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

// Lượt hỏi PU AI còn lại hôm nay (tự làm mới khi AI trả lời xong)
export function useAiQuota(enabled = true) {
  return useQuery({ queryKey: queryKeys.aiQuota, queryFn: chatApi.aiQuota, enabled, staleTime: 60 * 1000 })
}

// Gợi ý mở đầu theo chế độ học (server: hồ sơ quan tâm × mẫu câu); đổi chậm ⇒ cache 10 phút
export function useAiSuggestions(mode: AiMode, enabled = true) {
  return useQuery({ queryKey: queryKeys.aiSuggestions(mode), queryFn: () => chatApi.aiSuggestions(mode), enabled, staleTime: 10 * 60 * 1000 })
}

// Bấm gợi ý ⇒ phản hồi cho hồ sơ quan tâm (chủ đề được chọn mạnh lên)
export function trackSuggestionClick(source: 'starter' | 'panel' | 'followup', suggestion?: AiSuggestion) {
  const topic = suggestion?.topic
  track({ type: 'ai_suggestion_click', meta: topic ? { source, kind: topic.kind, key: topic.key.slice(0, 120) } : { source } })
}
