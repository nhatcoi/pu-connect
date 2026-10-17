'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LoginSession, SecurityEvent } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'

type Envelope<T> = { data: T }
const KEY = ['auth', 'sessions'] as const
const EVENTS_KEY = ['auth', 'security-events'] as const

// Thiết bị đang đăng nhập + nhật ký đăng nhập của chính mình
export function useLoginSessions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient<Envelope<LoginSession[]>>('/auth/sessions')).data
  })
}

export function useSecurityEvents() {
  return useQuery({
    queryKey: EVENTS_KEY,
    queryFn: async () => (await apiClient<Envelope<SecurityEvent[]>>('/auth/security-events')).data
  })
}

export function useRevokeSessions() {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: KEY })
    void qc.invalidateQueries({ queryKey: EVENTS_KEY })
  }
  const onError = (err: Error) => toast.error(err.message || 'Không thực hiện được')

  const one = useMutation({
    mutationFn: (id: string) => apiClient<void>(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Đã đăng xuất thiết bị')
      refresh()
    },
    onError
  })
  const others = useMutation({
    mutationFn: () => apiClient<Envelope<{ revoked: number }>>('/auth/sessions/revoke-others', { method: 'POST' }),
    onSuccess: (res) => {
      toast.success(`Đã đăng xuất ${res.data.revoked} thiết bị khác`)
      refresh()
    },
    onError
  })
  return { one, others }
}
