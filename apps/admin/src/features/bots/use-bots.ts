import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AdminBotOverview } from '@pu/schemas'
import { adminApi } from '@/lib/api'

export const BOTS_KEY = ['admin', 'bots'] as const
const POLL_MS = 10_000

export const useBotOverview = () =>
  useQuery({ queryKey: BOTS_KEY, queryFn: () => adminApi.get<AdminBotOverview>('/admin/bots'), refetchInterval: POLL_MS })

// Mutation trả về overview mới ⇒ ghi thẳng vào cache; lỗi hiện toast
export function useBotMutation<V>(call: (v: V) => Promise<AdminBotOverview>, onDone?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: (res) => {
      qc.setQueryData(BOTS_KEY, res)
      onDone?.()
    },
    onError: (e: Error) => toast.error(e.message)
  })
}
