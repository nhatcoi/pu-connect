'use client'

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BlockedUser } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'

type Envelope<T> = { success: boolean; data: T }

// REST chặn người dùng (apps/api/src/modules/blocks)
export const blocksApi = {
  list: async () => (await apiClient<Envelope<BlockedUser[]>>('/blocks')).data,
  block: (userId: string) => apiClient<void>(`/blocks/${userId}`, { method: 'PUT' }),
  unblock: (userId: string) => apiClient<void>(`/blocks/${userId}`, { method: 'DELETE' })
}

// Chặn ảnh hưởng hồ sơ, bảng tin, bình luận, tìm kiếm, gợi ý, hội thoại ⇒ làm mới các nhánh cache đó
const AFFECTED_ROOTS = [queryKeys.blocks, queryKeys.profileAll, queryKeys.feedAll, queryKeys.conversations, ['comments'], ['community'], ['search'], ['suggested-users']]

function refreshAfterBlockChange(qc: QueryClient) {
  for (const queryKey of AFFECTED_ROOTS) void qc.invalidateQueries({ queryKey })
}

export function useBlockedUsers(enabled = true) {
  return useQuery({ queryKey: queryKeys.blocks, queryFn: blocksApi.list, enabled })
}

export function useBlockActions() {
  const qc = useQueryClient()
  const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại, thử lại sau')
  const block = useMutation({
    mutationFn: blocksApi.block,
    onSuccess: () => {
      refreshAfterBlockChange(qc)
      toast.success('Đã chặn người dùng')
    },
    onError
  })
  const unblock = useMutation({
    mutationFn: blocksApi.unblock,
    onSuccess: () => {
      refreshAfterBlockChange(qc)
      toast.success('Đã bỏ chặn')
    },
    onError
  })
  return { block, unblock }
}

// Phía bên kia chặn / bỏ chặn mình ⇒ làm mới ngay (gắn MỘT lần trong AppLayout)
export function useBlocksRealtime() {
  const qc = useQueryClient()
  useRealtimeEvent('block.changed', () => refreshAfterBlockChange(qc))
}
