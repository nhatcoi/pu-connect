// Khóa cache tập trung: mọi useQuery / invalidate / prefetch dùng chung một nguồn
export type FeedType = 'for_you' | 'following' | 'qa' | 'courses' | 'explore' | 'bookmarks'
export type CommunitySort = 'hot' | 'new' | 'top'

export const queryKeys = {
  me: ['me'] as const,
  feed: (feedType: FeedType, tag?: string | null) => ['feed', feedType, tag ?? null] as const,
  feedAll: ['feed'] as const,
  post: (id: string) => ['post', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  profile: (username: string) => ['profile', username.toLowerCase()] as const,
  profileAll: ['profile'] as const,
  communities: ['communities'] as const,
  community: (slug: string, sort: CommunitySort) => ['community', slug, sort] as const,
  communityAll: (slug: string) => ['community', slug] as const,
  suggestedUsers: (limit: number) => ['suggested-users', limit] as const,
  search: (q: string, type: string, faculty?: string | null) => ['search', q, type, faculty ?? null] as const,
  notifications: (filter: string) => ['notifications', filter] as const
}

// Các nhánh cache có thể chứa bài viết (để cập nhật một bài ở mọi nơi)
export const POST_BEARING_ROOTS = ['feed', 'post', 'community', 'profile', 'search'] as const
