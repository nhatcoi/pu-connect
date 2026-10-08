import { StateCreator } from 'zustand'

// Chỉ trạng thái giao diện của bảng tin. Dữ liệu bài viết nằm trong cache React Query
// (lib/post-cache.ts: patchPostEverywhere / onPostCreated)
export interface FeedSlice {
  selectedTag: string | null
  isCreatePostOpen: boolean
  setSelectedTag: (tag: string | null) => void
  setCreatePostOpen: (open: boolean) => void
}

export const createFeedSlice: StateCreator<FeedSlice> = (set) => ({
  selectedTag: null,
  isCreatePostOpen: false,
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setCreatePostOpen: (open) => set({ isCreatePostOpen: open })
})
