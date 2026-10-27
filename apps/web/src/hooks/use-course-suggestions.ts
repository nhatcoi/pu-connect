'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CourseSuggestion, CourseSuggestionInput } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

type Envelope<T> = { success: boolean; data: T }

// Đề xuất môn học của tôi (kèm trạng thái duyệt)
export function useMyCourseSuggestions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.courseSuggestions,
    queryFn: async () => (await apiClient<Envelope<CourseSuggestion[]>>('/courses/suggestions/mine')).data,
    enabled
  })
}

export function useSuggestCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CourseSuggestionInput) =>
      (await apiClient<Envelope<CourseSuggestion>>('/courses/suggestions', { method: 'POST', body: JSON.stringify(body) })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.courseSuggestions })
  })
}
