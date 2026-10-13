import { z } from 'zod'

// Nhắn tin: DM, nhóm, hội thoại với PU AI (docs/core/06-messaging-and-ai.md)
export const SendMessageSchema = z.object({
  clientMsgId: z.string().uuid().optional(), // chống gửi trùng khi retry + optimistic UI
  content: z.string().trim().min(1, { message: 'Tin nhắn trống' }).max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' }),
  replyToId: z.string().regex(/^\d+$/).optional()
})
export type SendMessageInput = z.infer<typeof SendMessageSchema>

export const OpenDirectSchema = z.object({ userId: z.string().uuid() })

export const CreateGroupChatSchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150),
  memberIds: z.array(z.string().uuid()).min(1, { message: 'Chọn ít nhất 1 thành viên' }).max(49)
})
export type CreateGroupChatInput = z.infer<typeof CreateGroupChatSchema>

export const MarkReadSchema = z.object({ messageId: z.string().regex(/^\d+$/) })

export interface ChatUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isBot: boolean
}

export interface ChatCitation {
  type: 'citation'
  ref: { type: 'post' | 'document'; id: string }
  title: string
}

export interface ChatMessage {
  id: string // BIGSERIAL dạng chuỗi
  conversationId: string
  sender: ChatUser | null
  clientMsgId: string | null
  kind: 'text' | 'system' | 'ai'
  content: string
  blocks: ChatCitation[] | null
  replyToId: string | null
  status: 'streaming' | 'done' | 'error'
  deleted: boolean
  createdAt: string
}

export interface ConversationSummary {
  id: string
  type: 'direct' | 'group' | 'ai'
  title: string | null
  avatarUrl: string | null
  members: ChatUser[] // thành viên khác (không gồm mình)
  memberCount: number
  lastMessage: ChatMessage | null
  lastMessageAt: string | null
  unreadCount: number
  lastReadMessageId: string
}

export interface MessagesPage {
  data: ChatMessage[] // mới nhất trước
  nextCursor: string | null
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
