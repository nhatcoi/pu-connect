'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AiMode, ChatAttachment, ChatMessage, ChatReaction } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store'
import { chatApi } from './api'
import { patchMessages, syncPinned, upsertMessage, type UiMessage, type UiPage } from './cache'

export type Draft = {
  content: string
  attachments?: ChatAttachment[]
  replyTo?: UiMessage | null
  aiMode?: AiMode
}

// Bật/tắt cảm xúc của mình trên danh sách cảm xúc (dùng cho cập nhật lạc quan)
function toggleReaction(list: ChatReaction[], emoji: string, userId: string): ChatReaction[] {
  const hit = list.find((r) => r.emoji === emoji)
  if (!hit) return [...list, { emoji, userIds: [userId] }]
  const userIds = hit.userIds.includes(userId) ? hit.userIds.filter((id) => id !== userId) : [...hit.userIds, userId]
  return userIds.length ? list.map((r) => (r.emoji === emoji ? { ...r, userIds } : r)) : list.filter((r) => r.emoji !== emoji)
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
    async (draft: Draft, retryOf?: UiMessage) => {
      if (!me) return
      const clientMsgId = retryOf?.clientMsgId || crypto.randomUUID()
      const reply = draft.replyTo
      const optimistic: UiMessage = {
        id: `tmp-${clientMsgId}`,
        conversationId,
        sender: { id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl ?? null, isBot: false },
        clientMsgId,
        kind: 'text',
        content: draft.content,
        blocks: null,
        attachments: draft.attachments?.length ? draft.attachments : null,
        replyToId: reply?.id ?? null,
        replyTo: reply
          ? { id: reply.id, senderName: reply.sender?.displayName ?? null, content: reply.content.slice(0, 160), hasAttachments: !!reply.attachments, deleted: false }
          : null,
        reactions: [],
        meta: draft.aiMode && draft.aiMode !== 'ask' ? { aiMode: draft.aiMode } : null,
        status: 'sending',
        deleted: false,
        editedAt: null,
        pinnedAt: null,
        createdAt: new Date().toISOString()
      }
      upsertMessage(qc, optimistic)
      try {
        const saved = await chatApi.send(conversationId, {
          clientMsgId,
          content: draft.content,
          replyToId: reply?.id,
          attachments: draft.attachments?.length ? draft.attachments : undefined,
          aiMode: draft.aiMode
        })
        upsertMessage(qc, saved)
        void qc.invalidateQueries({ queryKey: queryKeys.conversations, exact: true })
      } catch (err: any) {
        upsertMessage(qc, { ...optimistic, status: 'failed' })
        if (err?.status && err.status < 500) toast.error(err.message)
      }
    },
    [conversationId, me, qc]
  )

  // Gửi lại tin lỗi với đúng nội dung cũ
  const retry = useCallback(
    (m: UiMessage) =>
      send(
        {
          content: m.content,
          attachments: m.attachments ?? undefined,
          replyTo: m.replyToId ? ({ id: m.replyToId, sender: null, content: m.replyTo?.content ?? '', attachments: null } as UiMessage) : null,
          aiMode: m.meta?.aiMode
        },
        m
      ),
    [send]
  )

  const apply = useCallback(
    (msg: ChatMessage) => {
      upsertMessage(qc, msg)
      syncPinned(qc, msg)
    },
    [qc]
  )
  const fail = (err: any) => toast.error(err?.message || 'Thao tác thất bại')

  const remove = useCallback((id: string) => chatApi.remove(id).then(apply, fail), [apply])
  const edit = useCallback((id: string, content: string) => chatApi.edit(id, content).then(apply, fail), [apply])
  const pin = useCallback((id: string) => chatApi.pin(id).then(apply, fail), [apply])
  const react = useCallback(
    (m: UiMessage, emoji: string) => {
      if (!me) return
      patchMessages(qc, conversationId, (pages) =>
        pages.map((p) => ({ ...p, data: p.data.map((x) => (x.id === m.id ? { ...x, reactions: toggleReaction(x.reactions, emoji, me.id) } : x)) }))
      )
      chatApi.react(m.id, emoji).then(apply, (err) => {
        upsertMessage(qc, m)
        fail(err)
      })
    },
    [apply, conversationId, me, qc]
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
    retry,
    remove,
    edit,
    pin,
    react
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
