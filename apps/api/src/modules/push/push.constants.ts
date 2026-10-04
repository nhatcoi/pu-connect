export const PUSH_QUEUE = 'notification-push'

// Chờ 30s rồi mới push: nếu người dùng đã đọc / đang mở app thì bỏ qua (tránh làm phiền)
export const PUSH_DELAY_MS = 30_000
// Tối đa 20 push / giờ / người (vượt ngưỡng ⇒ bỏ qua, vẫn còn in-app)
export const PUSH_RATE_LIMIT_PER_HOUR = 20
export const PUSH_TTL_SECONDS = 24 * 60 * 60

export interface PushJobData {
  notificationId: string
  recipientId: string
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string // cùng tag ⇒ thông báo hệ điều hành được thay thế (thông báo gộp)
  notificationId?: string
  type?: string
  unreadCount?: number
}
