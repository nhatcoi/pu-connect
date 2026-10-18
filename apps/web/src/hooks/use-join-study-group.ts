'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { StudyGroup } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

type Envelope<T> = { success: boolean; data: T }

// Tham gia nhóm học từ nơi khác trang học phần (vd. nút N7AI đề xuất): server kiểm sĩ số & thành viên trong transaction
// Thành công ⇒ cập nhật danh sách nhóm của học phần (nếu đã tải); nút tự đổi trạng thái nên không toast thành công
export function useJoinStudyGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => (await apiClient<Envelope<StudyGroup>>(`/study-groups/${groupId}/join`, { method: 'POST' })).data,
    onSuccess: (group) => {
      if (!group.courseCode) return
      qc.setQueryData<StudyGroup[]>(queryKeys.courseGroups(group.courseCode), (old) => old?.map((g) => (g.id === group.id ? group : g)))
    },
    onError: (err: Error) => toast.error(err.message || 'Không tham gia được nhóm học')
  })
}
