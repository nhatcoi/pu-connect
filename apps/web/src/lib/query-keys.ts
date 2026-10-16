// Khóa cache tập trung: mọi useQuery / invalidate / prefetch dùng chung một nguồn
export type FeedType = 'for_you' | 'following' | 'qa' | 'courses' | 'explore' | 'bookmarks'
export type CommunitySort = 'hot' | 'new' | 'top'

export const queryKeys = {
  me: ['me'] as const,
  feed: (feedType: FeedType, tag?: string | null) => ['feed', feedType, tag ?? null] as const,
  feedAll: ['feed'] as const,
  post: (id: string) => ['post', id] as const,
  postSummary: (id: string) => ['post-summary', id] as const,
  comments: (postId: string) => ['comments', postId] as const,
  profile: (username: string) => ['profile', username.toLowerCase()] as const,
  profileAll: ['profile'] as const,
  blocks: ['blocks'] as const,
  communities: ['communities'] as const,
  community: (slug: string, sort: CommunitySort) => ['community', slug, sort] as const,
  communityAll: (slug: string) => ['community', slug] as const,
  suggestedUsers: (limit: number) => ['suggested-users', limit] as const,
  // Modal khám phá: khóa riêng ⇒ không tự tải lại (người vừa theo dõi không biến mất giữa chừng)
  followSuggestions: (limit: number) => ['follow-suggestions', limit] as const,
  search: (q: string, type: string, faculty?: string | null) => ['search', q, type, faculty ?? null] as const,
  mentionSuggest: (q: string, postId: string | null) => ['mention-suggest', q.toLowerCase(), postId] as const,
  notifications: (filter: string) => ['notifications', filter] as const,
  courses: ['courses'] as const,
  course: (code: string) => ['course', code.toUpperCase()] as const,
  coursePosts: (code: string) => ['feed', 'course', code.toUpperCase()] as const,
  courseDocuments: (code: string) => ['course-documents', code.toUpperCase()] as const,
  courseGroups: (code: string) => ['course-groups', code.toUpperCase()] as const,
  conversations: ['conversations'] as const, // gốc: mọi dữ liệu hội thoại
  conversationLists: ['conversations', 'list'] as const,
  conversationList: (filter: string) => ['conversations', 'list', filter] as const,
  unreadMessages: ['conversations', 'unread'] as const,
  conversation: (id: string) => ['conversations', 'detail', id] as const,
  chatMembers: (id: string) => ['conversations', 'members', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  chatPinned: (id: string) => ['chat-pinned', id] as const,
  chatReactions: (messageId: string, sig: string) => ['chat-reactions', messageId, sig] as const,
  chatMedia: (id: string, kind: 'image' | 'file') => ['chat-media', id, kind] as const,
  chatSearch: (id: string, q: string) => ['chat-search', id, q] as const,
  chatMentions: (id: string, after: string) => ['chat-mentions', id, after] as const,
  chatRefs: (q: string, types: string) => ['chat-refs', q.trim().toLowerCase(), types] as const,
  aiQuota: ['ai-quota'] as const,
  aiThreadsAll: ['ai-threads'] as const,
  aiThreads: (q: string) => ['ai-threads', q.trim().toLowerCase()] as const,
  aiSkills: ['ai-skills'] as const,
  aiSkill: (id: string) => ['ai-skills', id] as const,
  aiConnectors: ['ai-connectors'] as const,
  aiSuggestions: (mode: string) => ['ai-suggestions', mode] as const,
  presence: ['presence'] as const,
  admin: (section: string, ...args: unknown[]) => ['admin', section, ...args] as const
}

// Các nhánh cache có thể chứa bài viết (để cập nhật một bài ở mọi nơi)
export const POST_BEARING_ROOTS = ['feed', 'post', 'community', 'profile', 'search'] as const
