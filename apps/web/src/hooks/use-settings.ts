'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  resolveFeaturePreferences,
  resolvePrivacySettings,
  type FeaturePreferenceKey,
  type FeaturePreferences,
  type PrivacySettings,
  type UserProfile
} from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store'

// Ghi user phiên vào cả cache /auth/me lẫn zustand (lệch nhau ⇒ useSession ghi đè giá trị cũ)
// Keep the me-query cache and the store in sync
export function useWriteSessionUser() {
  const queryClient = useQueryClient()
  return useCallback(
    (update: (user: UserProfile) => UserProfile) => {
      const current = useAppStore.getState().user
      if (!current) return
      const next = update(current)
      queryClient.setQueryData(queryKeys.me, next)
      useAppStore.getState().setUser(next)
    },
    [queryClient]
  )
}

// Công tắc lưu ngay: cập nhật lạc quan, lỗi ⇒ trả lại giá trị cũ
// Optimistic toggle with rollback; server merges partial patches so rapid toggles are safe
function useSettingsPatch<T extends object>(field: 'privacySettings' | 'preferences', endpoint: string, resolve: (raw: unknown) => T) {
  const writeUser = useWriteSessionUser()
  return useCallback(
    async (patch: Partial<T>) => {
      const before = resolve(useAppStore.getState().user?.[field])
      writeUser((u) => ({ ...u, [field]: { ...resolve(u[field]), ...patch } }))
      try {
        const res = await apiClient<{ data: unknown }>(endpoint, { method: 'PATCH', body: JSON.stringify(patch) })
        writeUser((u) => ({ ...u, [field]: resolve(res.data) }))
        return true
      } catch {
        writeUser((u) => ({ ...u, [field]: { ...resolve(u[field]), ...pick(before, Object.keys(patch)) } }))
        toast.error('Không lưu được cài đặt, thử lại sau')
        return false
      }
    },
    [field, endpoint, resolve, writeUser]
  )
}

function pick<T extends object>(obj: T, keys: string[]): Partial<T> {
  return Object.fromEntries(keys.map((k) => [k, (obj as Record<string, unknown>)[k]])) as Partial<T>
}

export function usePrivacySettings() {
  const raw = useAppStore((s) => s.user?.privacySettings)
  const update = useSettingsPatch<PrivacySettings>('privacySettings', '/users/privacy', resolvePrivacySettings)
  return { settings: resolvePrivacySettings(raw), update }
}

export function useFeaturePreferences() {
  const raw = useAppStore((s) => s.user?.preferences)
  const update = useSettingsPatch<FeaturePreferences>('preferences', '/users/preferences', resolveFeaturePreferences)
  return { preferences: resolveFeaturePreferences(raw), update }
}

// Đọc 1 cờ tính năng (khách chưa đăng nhập ⇒ mặc định)
export function useFeatureEnabled(key: FeaturePreferenceKey): boolean {
  const value = useAppStore((s) => s.user?.preferences?.[key])
  return value ?? resolveFeaturePreferences(undefined)[key]
}
