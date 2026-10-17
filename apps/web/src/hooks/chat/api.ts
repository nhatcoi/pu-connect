import type {
  AiLibraryKind,
  AiLibraryPage,
  AiFeedbackInput,
  AiMemory,
  AiSettings,
  AiSupportInput,
  AiTask,
  AiTaskInput,
  AiUsage,
  AiConnectorId,
  AiConnectorInfo,
  AiMode,
  AiPublicSkill,
  AiQuota,
  AiSkill,
  AiSkillDetail,
  AiSkillDraft,
  AiSkillInput,
  AiThread,
  AiThreadsPage,
  ChatRefSuggestion,
  ChatRefType,
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
import { API_BASE_URL, apiClient } from '@/lib/api-client'

type Envelope<T> = { success: boolean; data: T }
const unwrap = async <T>(p: Promise<Envelope<T>>) => (await p).data
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

export type SendBody = {
  clientMsgId: string
  content: string
  replyToId?: string
  attachments?: ChatAttachment[]
  aiMode?: AiMode
  refs?: { type: ChatRefType; id: string }[]
  skillId?: string
  research?: boolean
  connectors?: AiConnectorId[]
}

export const connectorSlug = (id: AiConnectorId) => id.replace(/_/g, '-')

const qs = (params: Record<string, string | number | null | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')

// REST client nhắn tin (apps/api/src/modules/chat)
export const chatApi = {
  list: (filter: ConversationFilter, cursor: string | null, limit = 20) =>
    unwrap(apiClient<Envelope<ConversationsPage>>(`/conversations?filter=${filter}&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)),
  get: (id: string) => unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/${id}`)),
  unread: async () => (await unwrap(apiClient<Envelope<{ total: number }>>('/conversations/unread-count'))).total,
  openDirect: (userId: string) => unwrap(apiClient<Envelope<ConversationSummary>>('/conversations/direct', json('POST', { userId }))),
  // PU AI chat nhanh: thread gần nhất, chưa có thì tạo
  openAi: () => unwrap(apiClient<Envelope<ConversationSummary>>('/conversations/ai', json('POST'))),
  openStudyGroup: (groupId: string) => unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/study-groups/${groupId}`, json('POST'))),
  createGroup: (title: string, memberIds: string[]) => unwrap(apiClient<Envelope<ConversationSummary>>('/conversations', json('POST', { title, memberIds }))),
  updateGroup: (id: string, body: UpdateGroupInput) => unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/${id}`, json('PATCH', body))),
  settings: (id: string, body: MemberSettingsInput) => unwrap(apiClient<Envelope<ConversationSummary>>(`/conversations/${id}/settings`, json('PATCH', body))),
  members: (id: string) => unwrap(apiClient<Envelope<ChatMember[]>>(`/conversations/${id}/members`)),
  addMembers: (id: string, userIds: string[]) => unwrap(apiClient<Envelope<ChatMember[]>>(`/conversations/${id}/members`, json('POST', { userIds }))),
  removeMember: (id: string, userId: string) => apiClient(`/conversations/${id}/members/${userId}`, json('DELETE')),
  transferOwner: (id: string, userId: string) => unwrap(apiClient<Envelope<ChatMember[]>>(`/conversations/${id}/owner`, json('POST', { userId }))),
  leave: (id: string) => apiClient(`/conversations/${id}/leave`, json('POST')),
  read: (id: string, messageId: string) => apiClient(`/conversations/${id}/read`, json('POST', { messageId })),
  unreadMentions: (id: string, after: string) => unwrap(apiClient<Envelope<string[]>>(`/conversations/${id}/mentions?${qs({ after })}`)),
  refs: (q: string, types: ChatRefType[], signal?: AbortSignal) =>
    unwrap(apiClient<Envelope<ChatRefSuggestion[]>>(`/chat/refs?${qs({ q, types: types.join(',') })}`, { signal })),

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
  aiReset: (id: string) => unwrap(apiClient<Envelope<ChatMessage>>(`/ai/conversations/${id}/reset`, json('POST'))),
  aiConnectors: () => unwrap(apiClient<Envelope<AiConnectorInfo[]>>('/ai/connectors')),
  // Connector Google: điều hướng cả trang (OAuth redirect); id 'google_drive' ⇒ slug 'google-drive'
  connectorConnectUrl: (id: AiConnectorId) => `${API_BASE_URL}/ai/connectors/${connectorSlug(id)}/connect`,
  disconnectConnector: (id: AiConnectorId) => apiClient(`/ai/connectors/${connectorSlug(id)}`, json('DELETE')),

  // PU AI nhiều hội thoại
  aiThreads: (q: string, cursor: string | null, signal?: AbortSignal) =>
    unwrap(apiClient<Envelope<AiThreadsPage>>(`/ai/threads?${qs({ q, cursor, limit: 20 })}`, { signal })),
  createAiThread: () => unwrap(apiClient<Envelope<ConversationSummary>>('/ai/threads', json('POST'))),
  renameAiThread: (id: string, title: string) => unwrap(apiClient<Envelope<AiThread>>(`/ai/threads/${id}`, json('PATCH', { title }))),
  deleteAiThread: (id: string) => apiClient(`/ai/threads/${id}`, json('DELETE')),
  aiLibrary: (kind: AiLibraryKind, cursor: string | null, signal?: AbortSignal) =>
    unwrap(apiClient<Envelope<AiLibraryPage>>(`/ai/library?${qs({ kind, cursor })}`, { signal })),

  // Skill tự tạo (slash command)
  skills: () => unwrap(apiClient<Envelope<AiSkill[]>>('/ai/skills')),
  skill: (id: string) => unwrap(apiClient<Envelope<AiSkillDetail>>(`/ai/skills/${id}`)),
  draftSkill: (prompt: string) => unwrap(apiClient<Envelope<AiSkillDraft>>('/ai/skills/draft', json('POST', { prompt }))),
  createSkill: (body: AiSkillInput) => unwrap(apiClient<Envelope<AiSkillDetail>>('/ai/skills', json('POST', body))),
  updateSkill: (id: string, body: AiSkillInput) => unwrap(apiClient<Envelope<AiSkillDetail>>(`/ai/skills/${id}`, json('PATCH', body))),
  deleteSkill: (id: string) => apiClient(`/ai/skills/${id}`, json('DELETE')),
  skillLibrary: (q: string, signal?: AbortSignal) => unwrap(apiClient<Envelope<AiPublicSkill[]>>(`/ai/skills/library?${qs({ q })}`, { signal })),
  installSkill: (id: string) => unwrap(apiClient<Envelope<AiSkillDetail>>(`/ai/skills/${id}/install`, json('POST'))),
  skillState: (id: string, state: { enabled?: boolean; pinned?: boolean }) =>
    unwrap(apiClient<Envelope<AiSkill>>(`/ai/skills/${id}/state`, json('PATCH', state))),

  // Cài đặt PU AI (docs/core/10-puai-settings.md)
  aiSettings: () => unwrap(apiClient<Envelope<AiSettings>>('/ai/settings')),
  updateAiSettings: (patch: Partial<AiSettings>) => unwrap(apiClient<Envelope<AiSettings>>('/ai/settings', json('PATCH', patch))),
  memories: () => unwrap(apiClient<Envelope<AiMemory[]>>('/ai/memories')),
  createMemory: (content: string) => unwrap(apiClient<Envelope<AiMemory>>('/ai/memories', json('POST', { content }))),
  updateMemory: (id: string, content: string) => unwrap(apiClient<Envelope<AiMemory>>(`/ai/memories/${id}`, json('PATCH', { content }))),
  deleteMemory: (id: string) => apiClient(`/ai/memories/${id}`, json('DELETE')),
  clearMemories: () => apiClient('/ai/memories', json('DELETE')),
  tasks: () => unwrap(apiClient<Envelope<AiTask[]>>('/ai/tasks')),
  createTask: (body: AiTaskInput) => unwrap(apiClient<Envelope<AiTask>>('/ai/tasks', json('POST', body))),
  updateTask: (id: string, body: AiTaskInput) => unwrap(apiClient<Envelope<AiTask>>(`/ai/tasks/${id}`, json('PATCH', body))),
  deleteTask: (id: string) => apiClient(`/ai/tasks/${id}`, json('DELETE')),
  runTask: (id: string) => unwrap(apiClient<Envelope<AiTask>>(`/ai/tasks/${id}/run`, json('POST'))),
  rateMessage: (id: string, body: AiFeedbackInput) => unwrap(apiClient<Envelope<{ rating: 1 | -1 }>>(`/ai/messages/${id}/feedback`, json('POST', body))),
  support: (body: AiSupportInput) => unwrap(apiClient<Envelope<{ id: string }>>('/ai/support', json('POST', body))),
  aiUsage: () => unwrap(apiClient<Envelope<AiUsage>>('/ai/usage')),
  exportAiData: () => unwrap(apiClient<Envelope<unknown>>('/ai/data/export')),
  deleteAiData: () => unwrap(apiClient<Envelope<{ threads: number }>>('/ai/data', json('DELETE')))
}
