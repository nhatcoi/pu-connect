export const CHAT_PUSH_QUEUE = 'chat-push'

// Chờ 15s rồi mới push: đọc kịp trong app ⇒ bỏ qua; nhiều tin trong lúc chờ ⇒ gộp 1 push
export const CHAT_PUSH_DELAY_MS = 15_000

// send: hiện thông báo tin mới · clear: đóng thông báo đã hiện (đã đọc ở thiết bị khác)
export type ChatPushJobName = 'send' | 'clear'

export interface ChatPushJobData {
  conversationId: string
  recipientId: string
}

// 1 job / (hội thoại, người nhận) đang chờ — BullMQ bỏ qua job trùng id ⇒ gộp tin (không dùng ':' trong id)
export const chatPushJobId = (conversationId: string, recipientId: string) => `chat-${conversationId}-${recipientId}`
export const chatClearJobId = (conversationId: string, recipientId: string) => `chat-clear-${conversationId}-${recipientId}`

// Tag thông báo OS của 1 hội thoại: tin sau thay tin trước, đóng theo tag khi đã đọc
export const chatNotificationTag = (conversationId: string) => `chat-${conversationId}`
