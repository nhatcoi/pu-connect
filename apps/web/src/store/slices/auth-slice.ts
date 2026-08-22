import { StateCreator } from 'zustand'
import type { UserProfile } from '@pu/schemas'

export interface AuthSlice {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoadingAuth: boolean
  setUser: (user: UserProfile | null) => void
  setAuth: (user: UserProfile) => void
  logout: () => void
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoadingAuth: false }),
  setAuth: (user) => set({ user, isAuthenticated: true, isLoadingAuth: false }),
  logout: () => set({ user: null, isAuthenticated: false, isLoadingAuth: false })
})
