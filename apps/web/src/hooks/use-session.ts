'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UserProfile } from '@pu/schemas'
import { apiClient, ApiError } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store'

async function fetchMe(): Promise<UserProfile | null> {
  try {
    const res = await apiClient<{ success: boolean; data: UserProfile }>('/auth/me')
    return res?.data ?? null
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null // chưa đăng nhập
    throw err
  }
}

// Phiên đăng nhập: gọi /auth/me MỘT lần cho cả phiên (dùng chung giữa mọi trang & component)
export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1
  })

  // Đồng bộ sang zustand (nhiều component đang đọc state.user)
  useEffect(() => {
    if (query.status !== 'success') return
    if (useAppStore.getState().user !== query.data || useAppStore.getState().isLoadingAuth) {
      useAppStore.getState().setUser(query.data)
    }
  }, [query.status, query.data])

  return {
    user: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError
  }
}
