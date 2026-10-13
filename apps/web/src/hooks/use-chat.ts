'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import type {
  ChatMessage,
  ConversationSummary,
  MessageDeltaEvent,
  MessagesPage,
  TypingEvent
} from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { getRealtimeSocket } from '@/lib/realtime'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'
import { useAppStore } from '@/store'

type Envelope<T> = { success: boolean; data: T }
// Tin gửi lạc quan (chưa có id thật) mang trạng thái 'sending' / 'failed'
export type UiMessage = Omit<ChatMessage, 'status'> & { status: ChatMessage['status'] | 'sending' | 'failed' }
type UiPage = { data: UiMessage[]; nextCursor: string | null }

const UNREAD_KEY = [...queryKeys.conversations, 'unread'] as const

export const chatApi = {
  list: async () => (await apiClient<Envelope<ConversationSummary[]>>('/conversations')).data,
  get: async (id: string) => (await apiClient<Envelope<ConversationSummary>>(`/conversations/${id}`)).data,
  unread: async () => (await apiClient<Envelope<{ total: number }>>('/conversations/unread-count')).data.total,
  openDirect: async (userId: string) =>
    (await apiClient<Envelope<ConversationSummary>>('/conversations/direct', { method: 'POST', body: JSON.stringify({ userId }) })).data,
  openAi: async () => (await apiClient<Envelope<ConversationSummary>>('/conversations/ai', { method: 'POST' })).data,
  createGroup: async (title: string, memberIds: string[]) =>
    (await apiClient<Envelope<ConversationSummary>>('/conversations', { method: 'POST', body: JSON.stringify({ title, memberIds }) })).data,
  messages: async (id: string, before?: string | null) => {
    const res = await apiClient<MessagesPage & { success: boolean }>(
      `/conversations/${id}/messages?limit=30${before ? `&before=${before}` : ''}`
    )
    return { data: res.data, nextCursor: res.nextCursor }
  },
  send: async (id: string, body: { clientMsgId: string; content: string }) =>
    (await apiClient<Envelope<ChatMessage>>(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(body) })).data,
  read: (id: string, messageId: string) =>
    apiClient(`/conversations/${id}/read`, { method: 'POST', body: JSON.stringify({ messageId }) }),
  remove: async (messageId: string) => (await apiClient<Envelope<ChatMessage>>(`/messages/${messageId}`, { method: 'DELETE' })).data,
  leave: (id: string) => apiClient(`/conversations/${id}/leave`, { method: 'POST' })
}

// Ai đang nhập ở hội thoại nào (tự hết hạn sau 5s nếu mất sự kiện dừng)
type TypingState = { typing: Record<string, Record<string, number>>; set: (e: TypingEvent) => void }
export const useTypingStore = create<TypingState>()((set) => ({
  typing: {},
  set: (e) =>
    set((s) => {
      const conv = { ...(s.typing[e.conversationId] || {}) }
      if (e.isTyping) conv[e.userId] = Date.now() + 5000
      else delete conv[e.userId]
      return { typing: { ...s.typing, [e.conversationId]: conv } }
    })
}))

// Sửa một tin trong cache tin nhắn của hội thoại (theo id hoặc clientMsgId)
function patchMessages(qc: QueryClient, conversationId: string, fn: (pages: UiPage[]) => UiPage[]) {
  qc.setQueryData<InfiniteData<UiPage>>(queryKeys.messages(conversationId), (old) =>
    old ? { ...old, pages: fn(old.pages) } : old
  )
}

function upsertMessage(qc: QueryClient, msg: UiMessage) {
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
    // Tin mới nhất nằm đầu trang đầu (sắp xếp mới → cũ)
    return [{ ...next[0], data: [msg, ...next[0].data] }, ...next.slice(1)]
  })
}

// Cầu nối socket → cache: gắn MỘT lần trong AppLayout
export function useChatRealtime() {
  const qc = useQueryClient()
  const refreshLists = useCallback(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.conversations })
  }, [qc])

  useRealtimeEvent<ChatMessage>('message.new', (msg) => {
    upsertMessage(qc, msg)
    refreshLists()
  })
  useRealtimeEvent<ChatMessage>('message.updated', (msg) => {
    upsertMessage(qc, msg)
    refreshLists()
  })
  // AI trả lời dần: nối delta vào nội dung tin đang streaming
  useRealtimeEvent<MessageDeltaEvent>('message.delta', (e) => {
    patchMessages(qc, e.conversationId, (pages) =>
      pages.map((p) => ({
        ...p,
        data: p.data.map((m) => (m.id === e.messageId ? { ...m, content: m.content + e.delta } : m))
      }))
    )
  })
  useRealtimeEvent('conv.read', refreshLists)
  useRealtimeEvent('conv.updated', refreshLists)
  useRealtimeEvent<TypingEvent>('typing', (e) => useTypingStore.getState().set(e))
}

export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: chatApi.list, staleTime: 30 * 1000 })
}

export function useUnreadMessages(): number {
  const userId = useAppStore((s) => s.user?.id)
  const { data } = useQuery({ queryKey: UNREAD_KEY, queryFn: chatApi.unread, staleTime: 60 * 1000, enabled: !!userId })
  return data ?? 0
}

export function useConversation(id: string) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: [...queryKeys.conversations, 'detail', id],
    queryFn: () => chatApi.get(id),
    // Có sẵn trong danh sách ⇒ hiện ngay
    initialData: () => qc.getQueryData<ConversationSummary[]>(queryKeys.conversations)?.find((c) => c.id === id),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 1000
  })
}

export function useMessages(conversationId: string) {
  const qc = useQueryClient()
  const me = useAppStore((s) => s.user)
  const query = useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam }) => chatApi.messages(conversationId, pageParam) as Promise<UiPage>,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: Infinity // socket giữ cache luôn mới
  })
  // Hiển thị cũ → mới
  const messages = (query.data?.pages.flatMap((p) => p.data) ?? []).slice().reverse()

  const send = useCallback(
    async (content: string, retryOf?: UiMessage) => {
      if (!me) return
      const clientMsgId = retryOf?.clientMsgId || crypto.randomUUID()
      const optimistic: UiMessage = {
        id: `tmp-${clientMsgId}`,
        conversationId,
        sender: { id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl ?? null, isBot: false },
        clientMsgId,
        kind: 'text',
        content,
        blocks: null,
        replyToId: null,
        status: 'sending',
        deleted: false,
        createdAt: new Date().toISOString()
      }
      upsertMessage(qc, optimistic)
      try {
        const saved = await chatApi.send(conversationId, { clientMsgId, content })
        upsertMessage(qc, saved)
        void qc.invalidateQueries({ queryKey: queryKeys.conversations })
      } catch {
        upsertMessage(qc, { ...optimistic, status: 'failed' })
      }
    },
    [conversationId, me, qc]
  )

  const remove = useCallback(
    async (messageId: string) => {
      upsertMessage(qc, await chatApi.remove(messageId))
    },
    [qc]
  )

  return {
    messages,
    isLoading: query.isPending,
    hasOlder: !!query.hasNextPage,
    loadOlder: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
    isLoadingOlder: query.isFetchingNextPage,
    send,
    remove
  }
}

// Đánh dấu đã đọc tin mới nhất (khi đang mở hội thoại & tab hiển thị)
export function useMarkRead(conversationId: string, latest: UiMessage | undefined, myId: string | undefined) {
  const qc = useQueryClient()
  const lastSent = useRef<string | null>(null)
  useEffect(() => {
    if (!latest || latest.id.startsWith('tmp-') || latest.sender?.id === myId) return
    if (lastSent.current === latest.id || document.visibilityState !== 'visible') return
    lastSent.current = latest.id
    void chatApi.read(conversationId, latest.id).then(() => qc.invalidateQueries({ queryKey: queryKeys.conversations }))
  }, [conversationId, latest, myId, qc])
}

// Báo "đang nhập" (tối đa 1 lần / 3s, tự dừng sau 4s không gõ)
export function useTypingEmitter(conversationId: string) {
  const lastSent = useRef(0)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emit = (isTyping: boolean) => getRealtimeSocket().emit('typing', { conversationId, isTyping })

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current)
    },
    []
  )

  return {
    onInput: () => {
      const now = Date.now()
      if (now - lastSent.current > 3000) {
        lastSent.current = now
        emit(true)
      }
      if (stopTimer.current) clearTimeout(stopTimer.current)
      stopTimer.current = setTimeout(() => {
        lastSent.current = 0
        emit(false)
      }, 4000)
    },
    stop: () => {
      if (stopTimer.current) clearTimeout(stopTimer.current)
      lastSent.current = 0
      emit(false)
    }
  }
}

// Tên hiển thị hội thoại
export function conversationTitle(c: ConversationSummary): string {
  if (c.type === 'ai') return 'PU AI'
  if (c.title) return c.title
  return c.members.map((m) => m.displayName).join(', ') || 'Hội thoại'
}
