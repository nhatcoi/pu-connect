import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { ChatMessage, ConversationSummary } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'

// Tin gửi lạc quan (chưa có id thật) mang trạng thái 'sending' / 'failed'
export type UiMessage = Omit<ChatMessage, 'status'> & { status: ChatMessage['status'] | 'sending' | 'failed' }
export type UiPage = { data: UiMessage[]; nextCursor: string | null }

// Sửa cache tin nhắn của 1 hội thoại (trang mới → cũ)
export function patchMessages(qc: QueryClient, conversationId: string, fn: (pages: UiPage[]) => UiPage[]) {
  qc.setQueryData<InfiniteData<UiPage>>(queryKeys.messages(conversationId), (old) => (old ? { ...old, pages: fn(old.pages) } : old))
}

// Thêm hoặc thay 1 tin (khớp theo id hoặc clientMsgId)
export function upsertMessage(qc: QueryClient, msg: UiMessage) {
  patchMessages(qc, msg.conversationId, (pages) => {
    let found = false
    const next = pages.map((p) => ({
      ...p,
      data: p.data.map((m) => {
        if (m.id === msg.id || (msg.clientMsgId && m.clientMsgId === msg.clientMsgId)) {
          found = true
          return msg
        }
        return m
      })
    }))
    if (found || !next.length) return next
    // Tin mới nhất nằm đầu trang đầu
    return [{ ...next[0], data: [msg, ...next[0].data] }, ...next.slice(1)]
  })
}

// Cập nhật tin trong danh sách "Đã ghim" khi ghim / bỏ ghim / thu hồi
export function syncPinned(qc: QueryClient, msg: ChatMessage) {
  qc.setQueryData<ChatMessage[]>(queryKeys.chatPinned(msg.conversationId), (old) => {
    if (!old) return old
    const rest = old.filter((m) => m.id !== msg.id)
    return msg.pinnedAt ? [msg, ...rest] : rest
  })
}

// Sửa 1 hội thoại ở cả danh sách lẫn chi tiết
export function patchConversation(qc: QueryClient, id: string, fn: (c: ConversationSummary) => ConversationSummary) {
  qc.setQueryData<ConversationSummary[]>(queryKeys.conversations, (old) => old?.map((c) => (c.id === id ? fn(c) : c)))
  qc.setQueryData<ConversationSummary>(queryKeys.conversation(id), (old) => (old ? fn(old) : old))
}
