'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

type Envelope<T> = { success: boolean; data: T }

// Id các môn đang theo dõi (mục "Đang theo dõi" ở trang Môn học & Tài liệu)
export function useFollowedCourseIds() {
  return useQuery({
    queryKey: queryKeys.courseFollows,
    queryFn: async () => (await apiClient<Envelope<string[]>>('/courses/followed')).data,
    staleTime: 5 * 60 * 1000
  })
}

// Bật / tắt theo dõi: cập nhật ngay trong cache, lỗi thì hoàn lại
export function useToggleFollowCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, follow }: { courseId: string; follow: boolean }) => apiClient(`/courses/${courseId}/follow`, { method: follow ? 'PUT' : 'DELETE' }),
    onMutate: async ({ courseId, follow }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courseFollows })
      const previous = queryClient.getQueryData<string[]>(queryKeys.courseFollows)
      queryClient.setQueryData<string[]>(queryKeys.courseFollows, (ids = []) => (follow ? [courseId, ...ids.filter((id) => id !== courseId)] : ids.filter((id) => id !== courseId)))
      return { previous }
    },
    onError: (_err, _vars, ctx) => queryClient.setQueryData(queryKeys.courseFollows, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.courseFollows })
  })
}
