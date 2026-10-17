// Loại thông báo đang dùng (khớp notification_type_enum)
export const NOTIFICATION_TYPES = [
  'post_like',
  'post_comment',
  'comment_reply',
  'user_mention',
  'user_follow',
  'accepted_solution',
  'account_verified',
  'account_notice',
  'ai_reply'
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// Loại người dùng được tắt/bật trong Cài đặt thông báo
export const CONFIGURABLE_TYPES: NotificationType[] = ['post_like', 'post_comment', 'comment_reply', 'user_mention', 'user_follow', 'accepted_solution']

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

const FENCE_LABELS: Record<string, string> = { quiz: '📝 Quiz', flashcards: '🗂️ Flashcard' }

// Markdown → văn bản thuần 1 dòng cho Web Push hệ điều hành & tiêu đề tự động
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```(\w+)?[^\n]*\n?[\s\S]*?(```|$)/g, (_, lang?: string) => ` ${(lang && FENCE_LABELS[lang]) || '[code]'} `)
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => alt || '🖼️')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-*:?\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](?!\s)([^*_\n]+?)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\\%/g, '%')
    .replace(/\s+/g, ' ')
    .trim()
}

export function snippet(text: string | null | undefined, max = 120): string {
  const clean = (text || '')
    .replace(/```(\w+)?[^\n]*\n?[\s\S]*?(```|$)/g, (_, lang?: string) => ` ${(lang && FENCE_LABELS[lang]) || '[code]'} `)
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
