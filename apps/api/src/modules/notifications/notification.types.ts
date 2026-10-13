// Loại thông báo đang dùng (khớp notification_type_enum)
export const NOTIFICATION_TYPES = [
  'post_like',
  'post_comment',
  'comment_reply',
  'user_mention',
  'user_follow',
  'accepted_solution',
  'account_verified',
  'ai_reply'
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// Loại người dùng được tắt/bật trong Cài đặt thông báo
export const CONFIGURABLE_TYPES: NotificationType[] = [
  'post_like',
  'post_comment',
  'comment_reply',
  'user_mention',
  'user_follow',
  'accepted_solution'
]

// Kênh chỉ có push (không tạo bản ghi notifications): tin nhắn chat — in-app đã có badge "Tin nhắn"
export const PUSH_ONLY_CHANNELS = ['chat_message'] as const
export type PushChannel = NotificationType | (typeof PUSH_ONLY_CHANNELS)[number]

export interface NotifyInput {
  type: NotificationType
  recipientId: string
  actorId: string | null
  // Hành động, ví dụ "đã thích bài viết của bạn"; tiêu đề = tên actor (+ N người khác) + verb
  verb: string
  message?: string // trích dẫn nội dung (snippet)
  entityType?: 'post' | 'comment' | 'user' | null
  entityId?: string | null
  link?: string | null
  // Có groupKey ⇒ gộp vào thông báo chưa đọc cùng nhóm ("A và 3 người khác …")
  groupKey?: string | null
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  entityId: string | null
  entityType: string | null
  actorsCount: number
  actor: { id: string; username: string; displayName: string; avatarUrl: string | null } | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export function snippet(text: string | null | undefined, max = 120): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
