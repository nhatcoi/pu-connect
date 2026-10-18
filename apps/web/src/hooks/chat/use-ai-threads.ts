'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AiThread, AiThreadShare, AiThreadsPage, ChatMessage } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

type ThreadData = InfiniteData<AiThreadsPage, string | null>

// Lịch sử hội thoại N7AI: 20 / trang (keyset), tìm theo tiêu đề ở server; socket vá cache ⇒ không refetch mỗi tin
export function useAiThreads(q: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.aiThreads(q),
    queryFn: ({ pageParam, signal }) => chatApi.aiThreads(q, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
    enabled
  })
  const threads = query.data?.pages.flatMap((p) => p.data) ?? []
  return { ...query, threads }
}

// Sửa mọi danh sách thread đã tải (mọi từ khóa tìm)
function mapThreadLists(qc: QueryClient, fn: (data: ThreadData, q: string) => ThreadData) {
  for (const [key, data] of qc.getQueriesData<ThreadData>({ queryKey: queryKeys.aiThreadsAll })) {
    if (data) qc.setQueryData(key, fn(data, String(key[1] ?? '')))
  }
}

const without = (data: ThreadData, id: string): ThreadData => ({ ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.filter((t) => t.id !== id) })) })
const prepend = (data: ThreadData, t: AiThread): ThreadData => {
  const rest = without(data, t.id)
  return { ...rest, pages: rest.pages.map((p, i) => (i === 0 ? { ...p, data: [t, ...p.data] } : p)) }
}
const matches = (t: AiThread, q: string) => !q || (t.title ?? '').toLowerCase().includes(q)

// Đổi tên / tự đặt tiêu đề (sự kiện ai.thread.updated): thay tại chỗ, chưa có thì thêm lên đầu
export function upsertAiThread(qc: QueryClient, thread: AiThread) {
  mapThreadLists(qc, (data, q) => {
    const present = data.pages.some((p) => p.data.some((t) => t.id === thread.id))
    if (present) return { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((t) => (t.id === thread.id ? { ...t, ...thread } : t)) })) }
    return matches(thread, q) ? prepend(data, thread) : data
  })
}

// Tin mới trong thread ⇒ đẩy lên đầu (thread đầu tiên có tin đến cùng sự kiện ai.thread.updated)
export function bumpAiThread(qc: QueryClient, msg: ChatMessage) {
  mapThreadLists(qc, (data) => {
    const hit = data.pages.flatMap((p) => p.data).find((t) => t.id === msg.conversationId)
    return hit ? prepend(data, { ...hit, lastMessageAt: msg.createdAt }) : data
  })
}

export function removeAiThread(qc: QueryClient, id: string) {
  mapThreadLists(qc, (data) => without(data, id))
}

// Trang chủ /n7ai: thread rỗng cho "Chat mới" (server dùng lại thread rỗng ⇒ gọi lặp vô hại)
// gcTime 0 ⇒ mỗi lần vào lại /n7ai đều hỏi server (thread cũ đã có tin thì nhận thread mới)
export function useAiDraftThread() {
  const qc = useQueryClient()
  return useQuery({
    queryKey: queryKeys.aiDraftThread,
    queryFn: async () => {
      const c = await chatApi.createAiThread()
      qc.setQueryData(queryKeys.conversation(c.id), c)
      return c
    },
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false
  })
}

// Đổi tên · xóa (chat mới = điều hướng tới /n7ai)
export function useAiThreadActions() {
  const qc = useQueryClient()
  const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại')

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => chatApi.renameAiThread(id, title),
    onSuccess: (t) => upsertAiThread(qc, t),
    onError
  })
  const remove = useMutation({
    mutationFn: (id: string) => chatApi.deleteAiThread(id),
    onSuccess: (_, id) => {
      removeAiThread(qc, id)
      qc.removeQueries({ queryKey: queryKeys.conversation(id) })
      qc.removeQueries({ queryKey: queryKeys.messages(id) })
    },
    onError
  })
  return { rename, remove }
}

// Link chia sẻ công khai của 1 thread: trạng thái + tạo / cập nhật ảnh chụp / ngắt
export function useAiThreadShare(id: string, enabled: boolean) {
  const qc = useQueryClient()
  const key = queryKeys.aiThreadShare(id)
  const query = useQuery({ queryKey: key, queryFn: () => chatApi.aiThreadShare(id), enabled, staleTime: 30 * 1000 })
  const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại')
  const share = useMutation({
    mutationFn: () => chatApi.shareAiThread(id),
    onSuccess: (s) => qc.setQueryData<AiThreadShare | null>(key, s),
    onError
  })
  const unshare = useMutation({
    mutationFn: () => chatApi.unshareAiThread(id),
    onSuccess: () => qc.setQueryData<AiThreadShare | null>(key, null),
    onError
  })
  return { ...query, share, unshare }
}
