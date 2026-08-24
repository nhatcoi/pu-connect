import { StateCreator } from 'zustand'
import type { PostItem } from '@pu/schemas'

export interface FeedSlice {
  posts: PostItem[]
  selectedTag: string | null
  isCreatePostOpen: boolean
  setPosts: (posts: PostItem[]) => void
  addPost: (post: PostItem) => void
  toggleLikePost: (postId: string) => void
  toggleBookmarkPost: (postId: string) => void
  setSelectedTag: (tag: string | null) => void
  setCreatePostOpen: (open: boolean) => void
}

export const createFeedSlice: StateCreator<FeedSlice> = (set) => ({
  posts: [],
  selectedTag: null,
  isCreatePostOpen: false,
  setPosts: (posts) => set({ posts }),
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  toggleLikePost: (postId) =>
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id === postId) {
          const isLiked = !post.isLikedByMe
          return {
            ...post,
            isLikedByMe: isLiked,
            likesCount: isLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1)
          }
        }
        return post
      })
    })),
  toggleBookmarkPost: (postId) =>
    set((state) => ({
      posts: state.posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            isBookmarkedByMe: !post.isBookmarkedByMe
          }
        }
        return post
      })
    })),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setCreatePostOpen: (open) => set({ isCreatePostOpen: open })
})
