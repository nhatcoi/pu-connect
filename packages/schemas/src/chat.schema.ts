import { z } from 'zod'
import type { BlockState } from './block.schema'

// Nhắn tin: DM, nhóm, hội thoại với PU AI (docs/core/06-messaging-and-ai.md)

export const CHAT_MAX_ATTACHMENTS = 10
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

// Chế độ học của PU AI: đổi chỉ dẫn hệ thống + cách hiển thị câu trả lời
export const AI_MODES = ['ask', 'explain', 'quiz', 'flashcards', 'summarize', 'plan'] as const
export type AiMode = (typeof AI_MODES)[number]

// Ngữ cảnh gắn vào tin (chip trên ô soạn): server kiểm quyền rồi mới lưu meta.refs
export const CHAT_MAX_REFS = 5
export const CHAT_REF_TYPES = ['course', 'document', 'post', 'thread'] as const
export type ChatRefType = (typeof CHAT_REF_TYPES)[number]

// Nguồn PU AI được đọc (connector); 'library' = mặc định; google_drive cần kết nối OAuth
export const AI_CONNECTORS = ['library', 'my_documents', 'my_groups', 'google_drive'] as const
export type AiConnectorId = (typeof AI_CONNECTORS)[number]

export const ChatAttachmentSchema = z.object({
  url: z.string().url(),
  key: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mime: z.string().min(1).max(150),
  kind: z.enum(['image', 'file'])
})
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>

export const SendMessageSchema = z
  .object({
    clientMsgId: z.string().uuid().optional(), // chống gửi trùng khi retry + optimistic UI
    content: z.string().trim().max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' }).default(''),
    replyToId: z.string().regex(/^\d+$/).optional(),
    attachments: z.array(ChatAttachmentSchema).max(CHAT_MAX_ATTACHMENTS).optional(),
    aiMode: z.enum(AI_MODES).optional(),
    refs: z
      .array(z.object({ type: z.enum(CHAT_REF_TYPES), id: z.string().uuid() }))
      .max(CHAT_MAX_REFS)
      .optional(),
    skillId: z.string().uuid().optional(),
    research: z.boolean().optional(),
    connectors: z.array(z.enum(AI_CONNECTORS)).max(AI_CONNECTORS.length).optional()
  })
  .refine((v) => v.content.length > 0 || (v.attachments?.length ?? 0) > 0, { message: 'Tin nhắn trống', path: ['content'] })
export type SendMessageInput = z.infer<typeof SendMessageSchema>

export const EditMessageSchema = z.object({
  content: z.string().trim().min(1, { message: 'Tin nhắn trống' }).max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' })
})
export type EditMessageInput = z.infer<typeof EditMessageSchema>

export const ReactSchema = z.object({ emoji: z.enum(CHAT_REACTIONS) })

export const OpenDirectSchema = z.object({ userId: z.string().uuid() })

export const CreateGroupChatSchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150),
  memberIds: z.array(z.string().uuid()).min(1, { message: 'Chọn ít nhất 1 thành viên' }).max(49)
})
export type CreateGroupChatInput = z.infer<typeof CreateGroupChatSchema>

export const UpdateGroupSchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150).optional(),
  // Key ảnh trong avatars/{userId}/ (tải lên trước); null = xóa ảnh nhóm
  avatarKey: z.string().max(300).nullable().optional()
})
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>

export const AddMembersSchema = z.object({ userIds: z.array(z.string().uuid()).min(1).max(49) })

// muted: số giờ tắt thông báo (0 = bật lại, -1 = đến khi bật lại)
export const MemberSettingsSchema = z.object({
  mutedHours: z
    .number()
    .int()
    .min(-1)
    .max(24 * 30)
    .optional(),
  pinned: z.boolean().optional()
})
export type MemberSettingsInput = z.infer<typeof MemberSettingsSchema>

export const MarkReadSchema = z.object({ messageId: z.string().regex(/^\d+$/) })

export interface ChatUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isBot: boolean
}

export interface ChatMember extends ChatUser {
  role: 'owner' | 'member'
  lastReadMessageId: string
  joinedAt: string
}

export interface ChatCitation {
  type: 'citation'
  ref: { type: 'post' | 'document'; id: string }
  title: string
}

export interface ChatReaction {
  emoji: string
  userIds: string[]
}

// Danh sách người đã thả cảm xúc (hộp thoại "Cảm xúc về tin nhắn")
export interface ChatReactionDetail {
  emoji: string
  user: ChatUser
  createdAt: string
}

export interface ChatReplyPreview {
  id: string
  senderName: string | null
  content: string
  hasAttachments: boolean
  deleted: boolean
}

// Tin hệ thống (thêm/xóa thành viên, đổi tên nhóm, làm mới ngữ cảnh AI)
export type ChatSystemEvent =
  'group.created' | 'group.renamed' | 'member.added' | 'member.removed' | 'member.left' | 'group.avatar' | 'owner.transferred' | 'ai.reset'

// Người được nhắc trong tin (client tô sáng @username khớp danh sách này)
export interface ChatMentionedUser {
  id: string
  username: string
}

export interface ChatRef {
  type: ChatRefType
  id: string
  title: string
  code?: string // học phần: mã môn (dựng link /courses/[code])
}

export interface ChatSkillRef {
  id: string
  slug: string
  name: string
}

export interface ChatMessageMeta {
  aiMode?: AiMode
  mentions?: ChatMentionedUser[]
  mentionAll?: boolean
  refs?: ChatRef[]
  skill?: ChatSkillRef
  research?: boolean
  connectors?: AiConnectorId[]
  event?: ChatSystemEvent
  actorName?: string
  targetNames?: string[]
  followUps?: string[] // PU AI: câu hỏi gợi ý tiếp theo (chip dưới câu trả lời)
}

export interface ChatMessage {
  id: string // BIGSERIAL dạng chuỗi
  conversationId: string
  sender: ChatUser | null
  clientMsgId: string | null
  kind: 'text' | 'system' | 'ai'
  content: string
  blocks: ChatCitation[] | null
  attachments: ChatAttachment[] | null
  replyToId: string | null
  replyTo: ChatReplyPreview | null
  reactions: ChatReaction[]
  meta: ChatMessageMeta | null
  status: 'streaming' | 'done' | 'error'
  deleted: boolean
  editedAt: string | null
  pinnedAt: string | null
  createdAt: string
}

export interface ConversationSummary {
  id: string
  type: 'direct' | 'group' | 'ai'
  title: string | null
  avatarUrl: string | null
  studyGroupId: string | null // nhóm chat gắn với nhóm học
  members: ChatUser[] // thành viên khác (không gồm mình)
  memberCount: number
  myRole: 'owner' | 'member'
  lastMessage: ChatMessage | null
  lastMessageAt: string | null
  unreadCount: number
  unreadMentions: number // tin nhắc mình (hoặc @all) chưa đọc ⇒ badge "@"
  lastReadMessageId: string
  // Con trỏ đã đọc của người khác (hiện "Đã xem")
  readCursors: Record<string, string>
  mutedUntil: string | null
  pinnedAt: string | null
  // DM: quan hệ chặn với người kia (khác 'none' ⇒ không gửi tin được)
  blockState: BlockState
}

// Danh sách hội thoại: lọc ở server + phân trang keyset (cursor mờ)
export const CONVERSATION_FILTERS = ['all', 'unread', 'group'] as const
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number]
export interface ConversationsPage {
  data: ConversationSummary[]
  nextCursor: string | null
}

export interface MessagesPage {
  data: ChatMessage[] // mới nhất trước
  nextCursor: string | null
}

// ── PU AI: nhiều hội thoại (thread), skill, connector, gợi ý ngữ cảnh ─────────

export interface AiThread {
  id: string
  title: string | null
  lastMessageAt: string | null
  createdAt: string
}
export interface AiThreadsPage {
  data: AiThread[]
  nextCursor: string | null
}

export const AiThreadUpdateSchema = z.object({ title: z.string().trim().min(1, { message: 'Nhập tên' }).max(150) })
export type AiThreadUpdateInput = z.infer<typeof AiThreadUpdateSchema>

export const AI_SKILL_LIMIT = 30
export const AiSkillInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, { message: 'Lệnh 2–40 ký tự: chữ thường không dấu, số, dấu gạch ngang' }),
  name: z.string().trim().min(1, { message: 'Nhập tên skill' }).max(60),
  description: z.string().trim().max(200).default(''),
  instructions: z.string().trim().min(10, { message: 'Chỉ dẫn tối thiểu 10 ký tự' }).max(4000, { message: 'Chỉ dẫn tối đa 4000 ký tự' }),
  inputHint: z.string().trim().max(150).nullable().optional()
})
export type AiSkillInput = z.infer<typeof AiSkillInputSchema>

// Danh sách nhẹ (không có instructions) — dùng cho menu "/"
export interface AiSkill {
  id: string
  slug: string
  name: string
  description: string
  inputHint: string | null
  useCount: number
}
export interface AiSkillDetail extends AiSkill {
  instructions: string
}

export interface AiConnectorInfo {
  id: AiConnectorId
  name: string
  description: string
  available: boolean // false = server chưa cấu hình
  requiresAuth: boolean // cần kết nối tài khoản ngoài
  connected: boolean
  account: string | null // email tài khoản đã kết nối
}

export interface ChatRefSuggestion {
  type: ChatRefType
  id: string
  title: string
  subtitle: string | null
  code?: string
}

export interface AiQuota {
  used: number
  limit: number
  enabled: boolean
}

// Sự kiện realtime (Socket.IO, room user:{id})
export interface MessageDeltaEvent {
  conversationId: string
  messageId: string
  delta: string
}
export interface TypingEvent {
  conversationId: string
  userId: string
  isTyping: boolean
}
export interface ReadEvent {
  conversationId: string
  userId: string
  lastReadMessageId: string
}

// Trạng thái hoạt động của người cùng hội thoại (GET /presence, event presence.update)
export interface PresenceInfo {
  online: boolean
  lastSeenAt: string | null
}
export type PresenceMap = Record<string, PresenceInfo>
export interface PresenceUpdateEvent extends PresenceInfo {
  userId: string
}
