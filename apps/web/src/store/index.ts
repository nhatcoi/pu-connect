import { create } from 'zustand'
import { AuthSlice, createAuthSlice } from './slices/auth-slice'
import { FeedSlice, createFeedSlice } from './slices/feed-slice'
import { DocumentSlice, createDocumentSlice } from './slices/document-slice'

export type AppStore = AuthSlice & FeedSlice & DocumentSlice

export const useAppStore = create<AppStore>()((...a) => ({
  ...createAuthSlice(...a),
  ...createFeedSlice(...a),
  ...createDocumentSlice(...a)
}))
