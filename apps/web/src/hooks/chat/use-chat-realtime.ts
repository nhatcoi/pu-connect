'use client'

import { useCallback, useEffect } from 'react'
import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import type { AiThread, ChatMessage, MessageDeltaEvent, MessageProgressEvent, ReadEvent, TypingEvent } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { bindSoundUnlock, playNotificationSound } from '@/lib/notification-sound'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'
import { getRealtimeSocket } from '@/lib/realtime'
import { finishSmooth, isSmoothing, pushSmooth } from '@/lib/smooth-stream'
import { useAppStore } from '@/store'
import {
  applyNewMessage,
  applyRead,
  applyUpdatedMessage,
  isAiConversation,
  shouldBeepForMessage,
  patchConversation,
  patchMessages,
  refreshConversationLists,
  syncPinned,
  upsertMessage
} from './cache'
import { bumpAiThread, removeAiThread, upsertAiThread } from './use-ai-threads'
import { useTypingStore } from './use-typing'
import { usePresenceRealtime } from './use-presence'

// Tin N7AI đang stream (placeholder) ⇒ bíp khi trả lời xong, không bíp lúc tạo placeholder
const streamingReplies = new Set<string>()

// Nội dung tin đang hiển thị (đã nhả) trong cache; null nếu không thấy
function shownContent(qc: QueryClient, conversationId: string, id: string): string | null {
  const data = qc.getQueryData<InfiniteData<{ data: ChatMessage[] }>>(queryKeys.messages(conversationId))
  for (const p of data?.pages ?? []) {
    const m = p.data.find((x) => x.id === id)
    if (m) return m.content
  }
  return null
}

// Cầu nối socket → cache: gắn MỘT lần trong AppLayout
export function useChatRealtime() {
  const qc = useQueryClient()
  const myId = useAppStore((s) => s.user?.id)
  const refreshLists = useCallback(() => refreshConversationLists(qc), [qc])

  // Mất kết nối có thể lỡ sự kiện ⇒ đồng bộ lại danh sách & badge khi nối lại
  useEffect(() => {
    if (!myId) return
    const manager = getRealtimeSocket().io
    manager.on('reconnect', refreshLists)
    return () => {
      manager.off('reconnect', refreshLists)
    }
  }, [myId, refreshLists])

  useEffect(bindSoundUnlock, [])
  useRealtimeEvent<ChatMessage>('message.new', (msg) => {
    upsertMessage(qc, msg)
    if (msg.status === 'streaming') streamingReplies.add(msg.id)
    else if (shouldBeepForMessage(qc, msg, myId)) playNotificationSound('message')
    applyNewMessage(qc, msg, myId)
    // Người gửi đã thôi nhập
    if (msg.sender) useTypingStore.getState().set({ conversationId: msg.conversationId, userId: msg.sender.id, isTyping: false })
    if (msg.kind === 'ai' || msg.attachments) void qc.invalidateQueries({ queryKey: ['chat-media', msg.conversationId] })
    if (msg.attachments && isAiConversation(qc, msg.conversationId)) void qc.invalidateQueries({ queryKey: queryKeys.aiLibraryAll })
    bumpAiThread(qc, msg) // chỉ khớp khi là thread N7AI đã nằm trong lịch sử
  })
  // Thread N7AI được đặt tên (tự động / đổi tên ở tab khác)
  useRealtimeEvent<AiThread>('ai.thread.updated', (t) => upsertAiThread(qc, t))
  useRealtimeEvent<ChatMessage>('message.updated', (incoming) => {
  // Còn chữ đang nhả dần ⇒ chờ nhả nốt rồi mới áp tin hoàn chỉnh (không nhảy cóc); cập nhật giữa chừng giữ nguyên chữ đang hiện
  const applyUpdate = (msg: ChatMessage) => {
    upsertMessage(qc, msg)
    syncPinned(qc, msg)
    applyUpdatedMessage(qc, msg)
    if (msg.status !== 'streaming' && streamingReplies.delete(msg.id) && shouldBeepForMessage(qc, msg, myId)) playNotificationSound('message')
    if (msg.kind === 'ai' && msg.status !== 'streaming') {
      void qc.invalidateQueries({ queryKey: queryKeys.aiQuota })
      void qc.invalidateQueries({ queryKey: queryKeys.aiConnectors })
      // N7AI vừa đọc / sửa ghi chú (tool note__*) ⇒ làm mới danh sách & nội dung ghi chú
      if (msg.meta?.steps?.some((st) => st.provider === 'note')) void qc.invalidateQueries({ queryKey: queryKeys.aiNotes })
      // Câu trả lời có quiz / flashcard ⇒ Thư viện › Học liệu
      if (/```(quiz|flashcards)/.test(msg.content)) void qc.invalidateQueries({ queryKey: queryKeys.aiLibrary('study') })
    }
  }
  if (incoming.status === 'streaming' && isSmoothing(incoming.id)) {
    const live = shownContent(qc, incoming.conversationId, incoming.id)
    applyUpdate(live === null ? incoming : { ...incoming, content: live })
  } else finishSmooth(incoming.id, () => applyUpdate(incoming))
  })
  // AI trả lời dần: nối delta vào nội dung tin đang streaming
  useRealtimeEvent<MessageDeltaEvent>('message.delta', (e) => {
    pushSmooth(e.messageId, e.delta, (chunk) =>
      patchMessages(qc, e.conversationId, (pages) =>
        pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === e.messageId ? { ...m, content: m.content + chunk } : m)) }))
      )
    )
  })
  // N7AI đang gọi Gmail / Drive / Lịch: thay danh sách bước của tin đang stream
  useRealtimeEvent<MessageProgressEvent>('message.progress', (e) => {
    patchMessages(qc, e.conversationId, (pages) =>
      pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === e.messageId ? { ...m, meta: { ...m.meta, steps: e.steps } } : m)) }))
    )
  })
  // Đã đọc: của mình ⇒ đồng bộ badge; của người khác ⇒ "Đã xem"
  useRealtimeEvent<ReadEvent>('conv.read', (e) => {
    if (e.userId === myId) return applyRead(qc, e.conversationId)
    patchConversation(qc, e.conversationId, (c) => ({ ...c, readCursors: { ...c.readCursors, [e.userId]: e.lastReadMessageId } }))
  })
  useRealtimeEvent<{ conversationId: string }>('conv.updated', (e) => {
    refreshLists()
    void qc.invalidateQueries({ queryKey: queryKeys.conversation(e.conversationId) })
    void qc.invalidateQueries({ queryKey: queryKeys.chatMembers(e.conversationId) })
  })
  useRealtimeEvent<{ conversationId: string }>('conv.removed', (e) => {
    refreshLists()
    removeAiThread(qc, e.conversationId)
    qc.removeQueries({ queryKey: queryKeys.conversation(e.conversationId) })
  })
  useRealtimeEvent<TypingEvent>('typing', (e) => useTypingStore.getState().set(e))
  usePresenceRealtime()
}
