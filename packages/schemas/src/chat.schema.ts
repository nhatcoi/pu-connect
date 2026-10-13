import { z } from 'zod'
import type { BlockState } from './block.schema'

// Nhắn tin: DM, nhóm, hội thoại với PU AI (docs/core/06-messaging-and-ai.md)

export const CHAT_MAX_ATTACHMENTS = 10
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

// Chế độ học của PU AI: đổi chỉ dẫn hệ thống + cách hiển thị câu trả lời
export const AI_MODES = ['ask', 'explain', 'quiz', 'flashcards', 'summarize', 'plan'] as const
export type AiMode = (typeof AI_MODES)[number]

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
    aiMode: z.enum(AI_MODES).optional()
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
  mutedHours: z.number().int().min(-1).max(24 * 30).optional(),
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
export type ChatSystemEvent = 'group.created' | 'group.renamed' | 'member.added' | 'member.removed' | 'member.left' | 'group.avatar' | 'owner.transferred' | 'ai.reset'

export interface ChatMessageMeta {
  aiMode?: AiMode
  event?: ChatSystemEvent
  actorName?: string
  targetNames?: string[]
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
  lastReadMessageId: string
  // Con trỏ đã đọc của người khác (hiện "Đã xem")
  readCursors: Record<string, string>
  mutedUntil: string | null
  pinnedAt: string | null
  // DM: quan hệ chặn với người kia (khác 'none' ⇒ không gửi tin được)
  blockState: BlockState
}

export interface MessagesPage {
  data: ChatMessage[] // mới nhất trước
  nextCursor: string | null
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

