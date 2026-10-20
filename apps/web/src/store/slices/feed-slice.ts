import { StateCreator } from 'zustand'
import type { FeedViewMode } from '@pu/schemas'

// Chỉ trạng thái giao diện của bảng tin. Dữ liệu bài viết nằm trong cache React Query
// (lib/post-cache.ts: patchPostEverywhere / onPostCreated)
export interface FeedSlice {
  feedViewOverride: { userId: string; mode: FeedViewMode } | null
  setFeedViewOverride: (override: FeedSlice['feedViewOverride']) => void
  selectedTag: string | null
  isCreatePostOpen: boolean
  setSelectedTag: (tag: string | null) => void
  setCreatePostOpen: (open: boolean) => void
}

export const createFeedSlice: StateCreator<FeedSlice> = (set) => ({
  feedViewOverride: null,
  setFeedViewOverride: (feedViewOverride) => set({ feedViewOverride }),
  selectedTag: null,
  isCreatePostOpen: false,
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setCreatePostOpen: (open) => set({ isCreatePostOpen: open })
})
