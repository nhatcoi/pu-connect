'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AiFolder, AiThread, AiThreadFolderFilter, AiThreadShare, AiThreadsPage, ChatMessage } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

type ThreadData = InfiniteData<AiThreadsPage, string | null>

// Lịch sử hội thoại N7AI: 20 / trang (keyset), lọc theo thư mục, tìm ở server; socket vá cache ⇒ không refetch mỗi tin
export function useAiThreads(q: string, folder: AiThreadFolderFilter, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.aiThreads(q, folder),
    queryFn: ({ pageParam, signal }) => chatApi.aiThreads(q, folder, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
    enabled
  })
  const threads = query.data?.pages.flatMap((p) => p.data) ?? []
  return { ...query, threads }
}

// Sửa mọi danh sách thread đã tải (mọi từ khóa tìm, mọi thư mục)
function mapThreadLists(qc: QueryClient, fn: (data: ThreadData, q: string, folder: AiThreadFolderFilter) => ThreadData) {
  for (const [key, data] of qc.getQueriesData<ThreadData>({ queryKey: queryKeys.aiThreadsAll })) {
    if (data) qc.setQueryData(key, fn(data, String(key[1] ?? ''), String(key[2] ?? 'all')))
  }
}

const without = (data: ThreadData, id: string): ThreadData => ({ ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.filter((t) => t.id !== id) })) })
const prepend = (data: ThreadData, t: AiThread): ThreadData => {
  const rest = without(data, t.id)
  return { ...rest, pages: rest.pages.map((p, i) => (i === 0 ? { ...p, data: [t, ...p.data] } : p)) }
}
const inFolder = (t: AiThread, folder: AiThreadFolderFilter) => folder === 'all' || (folder === 'root' ? !t.folderId : t.folderId === folder)
const matches = (t: AiThread, q: string, folder: AiThreadFolderFilter) => inFolder(t, folder) && (!q || (t.title ?? '').toLowerCase().includes(q))

// Đổi tên / tự đặt tiêu đề / chuyển thư mục (sự kiện ai.thread.updated): thay tại chỗ, rời danh sách không còn khớp, chưa có thì thêm lên đầu
export function upsertAiThread(qc: QueryClient, thread: AiThread) {
  mapThreadLists(qc, (data, q, folder) => {
    const present = data.pages.some((p) => p.data.some((t) => t.id === thread.id))
    if (present && !inFolder(thread, folder)) return without(data, thread.id)
    if (present) return { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((t) => (t.id === thread.id ? { ...t, ...thread } : t)) })) }
    return matches(thread, q, folder) ? prepend(data, thread) : data
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

// Đổi tên · chuyển thư mục · xóa (chat mới = điều hướng tới /n7ai)
export function useAiThreadActions() {
  const qc = useQueryClient()
  const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại')

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => chatApi.renameAiThread(id, title),
    onSuccess: (t) => upsertAiThread(qc, t),
    onError
  })
  const move = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) => chatApi.moveAiThread(id, folderId),
    onSuccess: (t) => {
      upsertAiThread(qc, t)
      void qc.invalidateQueries({ queryKey: queryKeys.aiFolders })
    },
    onError
  })
  const remove = useMutation({
    mutationFn: (id: string) => chatApi.deleteAiThread(id),
    onSuccess: (_, id) => {
      removeAiThread(qc, id)
      qc.removeQueries({ queryKey: queryKeys.conversation(id) })
      qc.removeQueries({ queryKey: queryKeys.messages(id) })
      void qc.invalidateQueries({ queryKey: queryKeys.aiFolders })
    },
    onError
  })
  return { rename, move, remove }
}

// Thư mục lịch sử N7AI + tạo / đổi tên / xóa (xóa ⇒ thread về Lịch sử)
export function useAiFolders() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: queryKeys.aiFolders, queryFn: chatApi.aiFolders, staleTime: 5 * 60 * 1000 })
  const setFolders = (fn: (list: AiFolder[]) => AiFolder[]) => qc.setQueryData<AiFolder[]>(queryKeys.aiFolders, (list) => fn(list ?? []))
  const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại')

  const create = useMutation({
    mutationFn: (name: string) => chatApi.createAiFolder(name),
    onSuccess: (f) => setFolders((list) => [...list, f]),
    onError
  })
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => chatApi.renameAiFolder(id, name),
    onSuccess: (f) => setFolders((list) => list.map((x) => (x.id === f.id ? { ...x, name: f.name } : x))),
    onError
  })
  const remove = useMutation({
    mutationFn: (id: string) => chatApi.deleteAiFolder(id),
    onSuccess: (_, id) => {
      setFolders((list) => list.filter((x) => x.id !== id))
      void qc.invalidateQueries({ queryKey: queryKeys.aiThreadsAll })
    },
    onError
  })
  return { folders: query.data ?? [], isPending: query.isPending, create, rename, remove }
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
