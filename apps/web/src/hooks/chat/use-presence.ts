'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PresenceInfo, PresenceMap, PresenceUpdateEvent } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { formatRelativeTime } from '@/lib/utils'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'
import { useAppStore } from '@/store'
import { chatApi } from './api'

// Trạng thái hoạt động của người cùng hội thoại: nạp 1 lần, sau đó cập nhật qua socket
function usePresenceMap() {
  const userId = useAppStore((s) => s.user?.id)
  return useQuery({ queryKey: queryKeys.presence, queryFn: chatApi.presence, enabled: !!userId, staleTime: 60 * 1000 })
}

export function usePresence(userId: string | undefined): PresenceInfo | null {
  const { data } = usePresenceMap()
  return (userId && data?.[userId]) || null
}

// Số người đang hoạt động trong danh sách (nhóm chat)
export function useOnlineCount(userIds: string[]): number {
  const { data } = usePresenceMap()
  return data ? userIds.filter((id) => data[id]?.online).length : 0
}

// "Đang hoạt động" / "Hoạt động 5 phút trước" / null (ẩn hoặc chưa từng online)
export function presenceLabel(p: PresenceInfo | null): string | null {
  if (!p) return null
  if (p.online) return 'Đang hoạt động'
  return p.lastSeenAt ? `Hoạt động ${formatRelativeTime(p.lastSeenAt).toLowerCase()}` : null
}

// Socket → cache (gắn trong useChatRealtime); chỉ vá khi đã nạp danh sách
export function usePresenceRealtime() {
  const qc = useQueryClient()
  useRealtimeEvent<PresenceUpdateEvent>('presence.update', ({ userId, ...info }) => {
    qc.setQueryData<PresenceMap>(queryKeys.presence, (map) => (map ? { ...map, [userId]: info } : map))
  })
}
