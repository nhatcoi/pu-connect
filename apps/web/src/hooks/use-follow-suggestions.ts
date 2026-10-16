'use client'

import { useQuery } from '@tanstack/react-query'
import type { FollowSuggestion } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

const fetchSuggestions = async (limit: number) => (await apiClient<{ data: FollowSuggestion[] }>(`/users/suggestions?limit=${limit}`)).data ?? []

// Cột phải: 3 gợi ý, làm mới sau mỗi lần theo dõi (invalidateFollowRelated)
export function useSidebarSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.suggestedUsers(3),
    queryFn: () => fetchSuggestions(3),
    enabled,
    staleTime: 10 * 60 * 1000
  })
}

// Modal khám phá: tải mới mỗi lần mở, giữ nguyên danh sách khi đang theo dõi
export function useExploreSuggestions(open: boolean) {
  return useQuery({
    queryKey: queryKeys.followSuggestions(30),
    queryFn: () => fetchSuggestions(30),
    enabled: open,
    staleTime: 0,
    gcTime: 60 * 1000
  })
}

// Dòng lý do gợi ý (tiếng Việt)
export function suggestionReasonText(s: FollowSuggestion): string {
  switch (s.reason) {
    case 'follows_you':
      return 'Đang theo dõi bạn'
    case 'mutual': {
      const first = s.mutuals[0]?.displayName
      const rest = s.mutualCount - 1
      return first ? `${first}${rest > 0 ? ` và ${rest} người khác` : ''} đang theo dõi` : `${s.mutualCount} người bạn theo dõi cũng theo dõi`
    }
    case 'same_class':
      return `Cùng lớp ${s.className}`
    case 'shared_interests':
      return `Cùng quan tâm ${s.sharedTags.join(', ')}`
    case 'same_faculty':
      return `Cùng khoa ${s.faculty}`
    default:
      return 'Nổi bật trong trường'
  }
}
