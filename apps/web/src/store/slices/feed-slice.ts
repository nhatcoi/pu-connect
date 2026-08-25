import { StateCreator } from 'zustand'
import type { PostItem } from '@pu/schemas'

export interface FeedSlice {
  posts: PostItem[]
  selectedTag: string | null
  isCreatePostOpen: boolean
  setPosts: (posts: PostItem[]) => void
  addPost: (post: PostItem) => void
  updatePost: (postId: string, updater: (prev: PostItem) => PostItem) => void
  hidePost: (postId: string) => void
  muteAuthor: (authorId: string) => void
  togglePinPost: (postId: string, isPinned?: boolean) => void
  toggleResolvePost: (postId: string, isResolved?: boolean) => void
  setAuthorFollowed: (authorId: string, isFollowed: boolean) => void
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
  updatePost: (postId, updater) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === postId ? updater(p) : p))
    })),
  hidePost: (postId) =>
    set((state) => ({
      posts: state.posts.filter((p) => p.id !== postId)
    })),
  muteAuthor: (authorId) =>
    set((state) => ({
      posts: state.posts.filter(
        (p) => p.authorId !== authorId && p.author?.id !== authorId
      )
    })),
  togglePinPost: (postId, isPinned) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId
          ? { ...p, isPinned: isPinned !== undefined ? isPinned : !p.isPinned }
          : p
      )
    })),
  toggleResolvePost: (postId, isResolved) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId
          ? { ...p, isResolved: isResolved !== undefined ? isResolved : !p.isResolved }
          : p
      )
    })),
  setAuthorFollowed: (authorId, isFollowed) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.authorId === authorId || p.author?.id === authorId
          ? { ...p, isAuthorFollowedByMe: isFollowed }
          : p
      )
    })),
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
