'use client'

import type { FeedViewMode } from '@pu/schemas'
import { useAppStore } from '@/store'

// Session override is scoped to the account; defaults remain server-owned.
// Chuyển ở Home không ghi đè mặc định trong Cài đặt.
export function useFeedViewMode() {
  const userId = useAppStore((s) => s.user?.id)
  const defaultMode = useAppStore((s) => s.user?.preferences?.feedViewMode ?? 'list')
  const override = useAppStore((s) => s.feedViewOverride)
  const setOverride = useAppStore((s) => s.setFeedViewOverride)
  const mode = override?.userId === userId ? (override?.mode ?? defaultMode) : defaultMode
  return {
    mode,
    setMode: (next: FeedViewMode) => {
      if (userId) setOverride({ userId, mode: next })
    }
  }
}
