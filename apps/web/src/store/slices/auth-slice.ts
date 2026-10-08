import { StateCreator } from 'zustand'
import type { UserProfile } from '@pu/schemas'
import { getQueryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'

export interface AuthSlice {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoadingAuth: boolean
  setUser: (user: UserProfile | null) => void
  setAuth: (user: UserProfile) => void
  logout: () => void
}

// Giữ cache ['me'] khớp với store (đăng nhập / đăng xuất / sửa hồ sơ ở bất kỳ đâu)
function syncSessionCache(user: UserProfile | null) {
  if (typeof window === 'undefined') return
  const qc = getQueryClient()
  if (qc.getQueryData(queryKeys.me) !== user) qc.setQueryData(queryKeys.me, user)
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  setUser: (user) => {
    syncSessionCache(user)
    set({ user, isAuthenticated: !!user, isLoadingAuth: false })
  },
  setAuth: (user) => {
    syncSessionCache(user)
    set({ user, isAuthenticated: true, isLoadingAuth: false })
  },
  logout: () => {
    // Xóa toàn bộ cache dữ liệu của người dùng cũ
    if (typeof window !== 'undefined') getQueryClient().clear()
    set({ user: null, isAuthenticated: false, isLoadingAuth: false })
  }
})
