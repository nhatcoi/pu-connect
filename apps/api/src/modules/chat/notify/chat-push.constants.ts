export const CHAT_PUSH_QUEUE = 'chat-push'

// Chờ 15s rồi mới push: đọc kịp trong app ⇒ bỏ qua; nhiều tin trong lúc chờ ⇒ gộp 1 push
export const CHAT_PUSH_DELAY_MS = 15_000

export interface ChatPushJobData {
  conversationId: string
  recipientId: string
}

// 1 job / (hội thoại, người nhận) đang chờ — BullMQ bỏ qua job trùng id ⇒ gộp tin (không dùng ':' trong id)
export const chatPushJobId = (conversationId: string, recipientId: string) => `chat-${conversationId}-${recipientId}`
