'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ChatMessage, MessageDeltaEvent, ReadEvent, TypingEvent } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'
import { useAppStore } from '@/store'
import { patchConversation, patchMessages, syncPinned, upsertMessage } from './cache'
import { useTypingStore } from './use-typing'
import { usePresenceRealtime } from './use-presence'

// Cầu nối socket → cache: gắn MỘT lần trong AppLayout
export function useChatRealtime() {
  const qc = useQueryClient()
  const myId = useAppStore((s) => s.user?.id)
  const refreshLists = useCallback(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.conversations, exact: true })
    void qc.invalidateQueries({ queryKey: [...queryKeys.conversations, 'unread'] })
  }, [qc])

  useRealtimeEvent<ChatMessage>('message.new', (msg) => {
    upsertMessage(qc, msg)
    refreshLists()
    // Người gửi đã thôi nhập
    if (msg.sender) useTypingStore.getState().set({ conversationId: msg.conversationId, userId: msg.sender.id, isTyping: false })
    if (msg.kind === 'ai' || msg.attachments) void qc.invalidateQueries({ queryKey: ['chat-media', msg.conversationId] })
  })
  useRealtimeEvent<ChatMessage>('message.updated', (msg) => {
    upsertMessage(qc, msg)
    syncPinned(qc, msg)
    refreshLists()
    if (msg.kind === 'ai' && msg.status !== 'streaming') void qc.invalidateQueries({ queryKey: queryKeys.aiQuota })
  })
  // AI trả lời dần: nối delta vào nội dung tin đang streaming
  useRealtimeEvent<MessageDeltaEvent>('message.delta', (e) => {
    patchMessages(qc, e.conversationId, (pages) =>
      pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === e.messageId ? { ...m, content: m.content + e.delta } : m)) }))
    )
  })
  // Đã đọc: của mình ⇒ đồng bộ badge; của người khác ⇒ "Đã xem"
  useRealtimeEvent<ReadEvent>('conv.read', (e) => {
    if (e.userId === myId) return refreshLists()
    patchConversation(qc, e.conversationId, (c) => ({ ...c, readCursors: { ...c.readCursors, [e.userId]: e.lastReadMessageId } }))
  })
  useRealtimeEvent<{ conversationId: string }>('conv.updated', (e) => {
    refreshLists()
    void qc.invalidateQueries({ queryKey: queryKeys.conversation(e.conversationId) })
    void qc.invalidateQueries({ queryKey: queryKeys.chatMembers(e.conversationId) })
  })
  useRealtimeEvent<{ conversationId: string }>('conv.removed', (e) => {
    refreshLists()
    qc.removeQueries({ queryKey: queryKeys.conversation(e.conversationId) })
  })
  useRealtimeEvent<TypingEvent>('typing', (e) => useTypingStore.getState().set(e))
  usePresenceRealtime()
}
