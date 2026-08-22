import { StateCreator } from 'zustand'
import type { UserProfile } from '@pu/schemas'

export interface AuthSlice {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: UserProfile, token: string) => void
  logout: () => void
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
  logout: () => set({ user: null, token: null, isAuthenticated: false })
})
