'use client'

import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AiThread, ChatMessage, MessageDeltaEvent, ReadEvent, TypingEvent } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'
import { getRealtimeSocket } from '@/lib/realtime'
import { useAppStore } from '@/store'
import {
  applyNewMessage,
  applyRead,
  applyUpdatedMessage,
  isAiConversation,
  patchConversation,
  patchMessages,
  refreshConversationLists,
  syncPinned,
  upsertMessage
} from './cache'
import { bumpAiThread, removeAiThread, upsertAiThread } from './use-ai-threads'
import { useTypingStore } from './use-typing'
import { usePresenceRealtime } from './use-presence'

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

  useRealtimeEvent<ChatMessage>('message.new', (msg) => {
    upsertMessage(qc, msg)
    applyNewMessage(qc, msg, myId)
    // Người gửi đã thôi nhập
    if (msg.sender) useTypingStore.getState().set({ conversationId: msg.conversationId, userId: msg.sender.id, isTyping: false })
    if (msg.kind === 'ai' || msg.attachments) void qc.invalidateQueries({ queryKey: ['chat-media', msg.conversationId] })
    if (msg.attachments && isAiConversation(qc, msg.conversationId)) void qc.invalidateQueries({ queryKey: queryKeys.aiLibraryAll })
    bumpAiThread(qc, msg) // chỉ khớp khi là thread N7AI đã nằm trong lịch sử
  })
  // Thread N7AI được đặt tên (tự động / đổi tên ở tab khác)
  useRealtimeEvent<AiThread>('ai.thread.updated', (t) => upsertAiThread(qc, t))
  useRealtimeEvent<ChatMessage>('message.updated', (msg) => {
    upsertMessage(qc, msg)
    syncPinned(qc, msg)
    applyUpdatedMessage(qc, msg)
    if (msg.kind === 'ai' && msg.status !== 'streaming') {
      void qc.invalidateQueries({ queryKey: queryKeys.aiQuota })
      // Câu trả lời có quiz / flashcard ⇒ Thư viện › Học liệu
      if (/```(quiz|flashcards)/.test(msg.content)) void qc.invalidateQueries({ queryKey: queryKeys.aiLibrary('study') })
    }
  })
  // AI trả lời dần: nối delta vào nội dung tin đang streaming
  useRealtimeEvent<MessageDeltaEvent>('message.delta', (e) => {
    patchMessages(qc, e.conversationId, (pages) =>
      pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === e.messageId ? { ...m, content: m.content + e.delta } : m)) }))
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
