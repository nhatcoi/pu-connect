import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { AiThreadsPage, ChatMessage, ConversationSummary, ConversationsPage } from '@pu/schemas'
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

// ── Danh sách hội thoại (phân trang, mỗi bộ lọc 1 cache) ─────────────────────
// Sự kiện socket vá thẳng cache ⇒ không tải lại danh sách / badge mỗi tin nhắn

export type ConversationListData = InfiniteData<ConversationsPage, string | null>

const isMuted = (c: ConversationSummary) => !!c.mutedUntil && new Date(c.mutedUntil).getTime() > Date.now()
// Badge "Tin nhắn" giống server: bỏ hội thoại tắt tiếng & thread PU AI (dòng AI vẫn hiện chấm chưa đọc)
const countsInBadge = (c: ConversationSummary) => c.type !== 'ai' && !isMuted(c)
// Nhóm thứ tự giống server: PU AI chat nhanh → đã ghim → còn lại
const rankOf = (c: ConversationSummary) => (c.type === 'ai' ? 2 : c.pinnedAt ? 1 : 0)

// Thread PU AI (đang mở / trong lịch sử) — không tính vào badge chưa đọc
export function isAiConversation(qc: QueryClient, id: string): boolean {
  if (qc.getQueryData<ConversationSummary>(queryKeys.conversation(id))?.type === 'ai') return true
  return qc
    .getQueriesData<InfiniteData<AiThreadsPage>>({ queryKey: queryKeys.aiThreadsAll })
    .some(([, d]) => d?.pages.some((p) => p.data.some((t) => t.id === id)))
}

// Hội thoại đang mở & đang nhìn thấy ⇒ tin mới không tính chưa đọc (useMarkRead sẽ báo đã đọc)
let activeConversationId: string | null = null
export function setActiveConversation(id: string | null) {
  activeConversationId = id
}
const isViewing = (id: string) => activeConversationId === id && document.visibilityState === 'visible'

function mapLists(qc: QueryClient, fn: (data: ConversationListData, filter: string) => ConversationListData) {
  for (const [key, data] of qc.getQueriesData<ConversationListData>({ queryKey: queryKeys.conversationLists })) {
    if (data) qc.setQueryData(key, fn(data, String(key[2])))
  }
}

// Tìm trong mọi danh sách đã tải (kèm thời điểm tải để làm initialData)
export function findConversation(qc: QueryClient, id: string): { conversation: ConversationSummary; updatedAt: number } | null {
  for (const [key, data] of qc.getQueriesData<ConversationListData>({ queryKey: queryKeys.conversationLists })) {
    const hit = data?.pages.flatMap((p) => p.data).find((c) => c.id === id)
    if (hit) return { conversation: hit, updatedAt: qc.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return null
}

// Sửa 1 hội thoại ở mọi danh sách lẫn chi tiết
export function patchConversation(qc: QueryClient, id: string, fn: (c: ConversationSummary) => ConversationSummary) {
  mapLists(qc, (data) => ({ ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((c) => (c.id === id ? fn(c) : c)) })) }))
  qc.setQueryData<ConversationSummary>(queryKeys.conversation(id), (old) => (old ? fn(old) : old))
}

// Tin nhắc mình (server đã lọc thành viên ⇒ meta.mentions đáng tin)
const mentionsMe = (msg: ChatMessage, myId: string | undefined) => !!msg.meta?.mentionAll || !!msg.meta?.mentions?.some((m) => m.id === myId)

const bumpUnread = (qc: QueryClient, delta: number) => qc.setQueryData<number>(queryKeys.unreadMessages, (n) => (n === undefined ? n : Math.max(0, n + delta)))

// Tin mới: cập nhật tin cuối + chưa đọc, đưa hội thoại lên đầu nhóm của nó
// Không có trong cache (hội thoại mới / thread AI chat nhanh vừa đổi / ở trang chưa tải) ⇒ tải lại danh sách đang mở
export function applyNewMessage(qc: QueryClient, msg: ChatMessage, myId: string | undefined) {
  const mine = msg.sender?.id === myId
  const countsUnread = !mine && msg.kind !== 'system' && !isViewing(msg.conversationId)
  const found = findConversation(qc, msg.conversationId)?.conversation
  if (!found) {
    void qc.invalidateQueries({ queryKey: queryKeys.conversationLists, refetchType: 'active' })
    if (countsUnread && !isAiConversation(qc, msg.conversationId)) void qc.invalidateQueries({ queryKey: queryKeys.unreadMessages })
    return
  }
  if (found.lastMessage?.id === msg.id) return // sự kiện lặp (nhiều tab / gửi lại) ⇒ không đếm 2 lần

  // Tin của mình (kể cả từ tab khác) ⇒ server đã coi như đã đọc hội thoại
  const unreadCount = mine ? 0 : found.unreadCount + (countsUnread ? 1 : 0)
  const unreadMentions = mine ? 0 : found.unreadMentions + (countsUnread && mentionsMe(msg, myId) ? 1 : 0)
  const next: ConversationSummary = { ...found, lastMessage: msg, lastMessageAt: msg.createdAt, unreadCount, unreadMentions }
  if (countsInBadge(next)) bumpUnread(qc, Math.min(unreadCount, 99) - Math.min(found.unreadCount, 99))
  const belongs: Record<string, boolean> = { all: true, group: next.type === 'group', unread: next.unreadCount > 0 }
  let stale = false
  mapLists(qc, (data, filter) => {
    const present = data.pages.some((p) => p.data.some((c) => c.id === next.id))
    if (!present) {
      stale ||= !!belongs[filter]
      return data
    }
    // PU AI / đã ghim: giữ vị trí; còn lại: lên đầu nhóm "thường"
    if (rankOf(next) > 0) return { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((c) => (c.id === next.id ? next : c)) })) }
    const pages = data.pages.map((p) => ({ ...p, data: p.data.filter((c) => c.id !== next.id) }))
    const first = pages[0].data
    const at = first.findIndex((c) => rankOf(c) === 0)
    pages[0] = { ...pages[0], data: at === -1 ? [...first, next] : [...first.slice(0, at), next, ...first.slice(at)] }
    return { ...data, pages }
  })
  qc.setQueryData<ConversationSummary>(queryKeys.conversation(next.id), (old) =>
    old ? { ...old, lastMessage: msg, lastMessageAt: msg.createdAt, unreadCount, unreadMentions } : old
  )
  if (stale) void qc.invalidateQueries({ queryKey: queryKeys.conversationLists, refetchType: 'active' })
}

// Tin cuối bị sửa / thu hồi / AI trả lời xong ⇒ cập nhật dòng xem trước
export function applyUpdatedMessage(qc: QueryClient, msg: ChatMessage) {
  patchConversation(qc, msg.conversationId, (c) => (c.lastMessage?.id === msg.id ? { ...c, lastMessage: msg } : c))
}

// Mình đã đọc (tab này hoặc tab khác) ⇒ về 0 và trừ badge đúng một lần
export function applyRead(qc: QueryClient, conversationId: string) {
  const found = findConversation(qc, conversationId)?.conversation ?? qc.getQueryData<ConversationSummary>(queryKeys.conversation(conversationId))
  // Không có số liệu trong cache ⇒ hỏi lại server badge
  if (!found) return void qc.invalidateQueries({ queryKey: queryKeys.unreadMessages })
  if (!found.unreadCount && !found.unreadMentions) return
  patchConversation(qc, conversationId, (c) => ({ ...c, unreadCount: 0, unreadMentions: 0 }))
  if (countsInBadge(found)) bumpUnread(qc, -Math.min(found.unreadCount, 99))
}

// Danh sách / badge đổi theo cách không suy ra được từ sự kiện (thêm/rời nhóm, mất kết nối)
export function refreshConversationLists(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: queryKeys.conversationLists })
  void qc.invalidateQueries({ queryKey: queryKeys.unreadMessages })
}
