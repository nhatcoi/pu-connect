import type {
  AiMode,
  AiQuota,
  AiSuggestionsResponse,
  ChatAttachment,
  ChatMember,
  ChatMessage,
  ChatReactionDetail,
  ConversationFilter,
  ConversationSummary,
  ConversationsPage,
  MemberSettingsInput,
  MessagesPage,
  PresenceMap,
  UpdateGroupInput
} from '@pu/schemas'
import { apiClient } from '@/lib/api-client'

type Envelope<T> = { success: boolean; data: T }
const unwrap = async <T>(p: Promise<Envelope<T>>) => (await p).data
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

export type SendBody = {
  clientMsgId: string
  content: string
  replyToId?: string
  attachments?: ChatAttachment[]
  aiMode?: AiMode
}

// REST client nhắn tin (apps/api/src/modules/chat)
export const chatApi = {
  list: (filter: ConversationFilter, cursor: string | null, limit = 20) =>
    unwrap(apiClient<Envelope<ConversationsPage>>(`/conversations?filter=${filter}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)),
  get: (id: string) => unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/${id}`)),
  unread: async () => (await unwrap(apiClient<Envelope<{ total: number }>>('/conversations/unread-count'))).total,
  openDirect: (userId: string) => unwrap(apiClient<Envelope<ConversationSummary>>('/conversations/direct', json('POST', { userId }))),
  openStudyGroup: (groupId: string) => unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/study-groups/${groupId}`, json('POST'))),
  openAi: () => unwrap(apiClient<Envelope<ConversationSummary>>('/conversations/ai', json('POST'))),
  createGroup: (title: string, memberIds: string[]) =>
    unwrap(apiClient<Envelope<ConversationSummary>>('/conversations', json('POST', { title, memberIds }))),
  updateGroup: (id: string, body: UpdateGroupInput) => unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/${id}`, json('PATCH', body))),
  settings: (id: string, body: MemberSettingsInput) =>
    unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/${id}/settings`, json('PATCH', body))),
  members: (id: string) => unwrap(apiClient<Envelope<ChatMember[]>>(`/conversations/${id}/members`)),
  addMembers: (id: string, userIds: string[]) => unwrap(apiClient<Envelope<ChatMember[]>>(`/conversations/${id}/members`, json('POST', { userIds }))),
  removeMember: (id: string, userId: string) => apiClient(`/conversations/${id}/members/${userId}`, json('DELETE')),
  transferOwner: (id: string, userId: string) => unwrap(apiClient<Envelope<ChatMember[]>>(`/conversations/${id}/owner`, json('POST', { userId }))),
  leave: (id: string) => apiClient(`/conversations/${id}/leave`, json('POST')),
  read: (id: string, messageId: string) => apiClient(`/conversations/${id}/read`, json('POST', { messageId })),

  messages: async (id: string, before?: string | null): Promise<MessagesPage> => {
    const res = await apiClient<MessagesPage & { success: boolean }>(`/conversations/${id}/messages?limit=30${before ? `&before=${before}` : ''}`)
    return { data: res.data, nextCursor: res.nextCursor }
  },
  send: (id: string, body: SendBody) => unwrap(apiClient<Envelope<ChatMessage>>(`/conversations/${id}/messages`, json('POST', body))),
  edit: (messageId: string, content: string) => unwrap(apiClient<Envelope<ChatMessage>>(`/messages/${messageId}`, json('PATCH', { content }))),
  remove: (messageId: string) => unwrap(apiClient<Envelope<ChatMessage>>(`/messages/${messageId}`, json('DELETE'))),
  react: (messageId: string, emoji: string) => unwrap(apiClient<Envelope<ChatMessage>>(`/messages/${messageId}/reactions`, json('POST', { emoji }))),
  reactions: (messageId: string) => unwrap(apiClient<Envelope<ChatReactionDetail[]>>(`/messages/${messageId}/reactions`)),
  pin: (messageId: string) => unwrap(apiClient<Envelope<ChatMessage>>(`/messages/${messageId}/pin`, json('POST'))),
  pinned: (id: string) => unwrap(apiClient<Envelope<ChatMessage[]>>(`/conversations/${id}/pinned`)),
  attachments: (id: string, kind: 'image' | 'file') => unwrap(apiClient<Envelope<ChatMessage[]>>(`/conversations/${id}/attachments?kind=${kind}`)),
  search: (id: string, q: string) => unwrap(apiClient<Envelope<ChatMessage[]>>(`/conversations/${id}/messages/search?q=${encodeURIComponent(q)}`)),

  aiQuota: () => unwrap(apiClient<Envelope<AiQuota>>('/ai/quota')),
  aiSuggestions: (mode: AiMode) => unwrap(apiClient<Envelope<AiSuggestionsResponse>>(`/ai/suggestions?mode=${mode}`)),
  presence: () => unwrap(apiClient<Envelope<PresenceMap>>('/presence')),
  aiReset: (id: string) => unwrap(apiClient<Envelope<ChatMessage>>(`/ai/conversations/${id}/reset`, json('POST')))
}
