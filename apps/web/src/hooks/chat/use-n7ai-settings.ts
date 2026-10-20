'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AiMemory, AiSettings, AiSkill, AiTask, AiTaskInput } from '@pu/schemas'
import { errorMessage } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { chatApi, type AiSettingsPatch } from './api'

const onError = (err: unknown) => toast.error(errorMessage(err, 'Thao tác thất bại'))

// Cài đặt N7AI (bộ nhớ, thời gian lưu, connector mặc định): cập nhật lạc quan, lỗi ⇒ trả lại
export function useAiSettings(enabled = true) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: queryKeys.aiSettings, queryFn: chatApi.aiSettings, staleTime: 5 * 60 * 1000, enabled })
  const update = useMutation({
    mutationFn: (patch: AiSettingsPatch) => chatApi.updateAiSettings(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: queryKeys.aiSettings })
      const prev = qc.getQueryData<AiSettings>(queryKeys.aiSettings)
      if (prev) qc.setQueryData<AiSettings>(queryKeys.aiSettings, { ...prev, ...patch, profile: { ...prev.profile, ...patch.profile } })
      return { prev }
    },
    onError: (err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.aiSettings, ctx.prev)
      onError(err)
    },
    onSuccess: (s) => qc.setQueryData(queryKeys.aiSettings, s)
  })
  return { settings: query.data, isLoading: query.isPending, update }
}

// Danh mục model do admin quản lý (menu chọn ở ô soạn tin)
export function useAiModelOptions(enabled = true) {
  return useQuery({ queryKey: queryKeys.aiModels, queryFn: chatApi.aiModels, staleTime: 5 * 60 * 1000, enabled })
}

const sortMemories = (list: AiMemory[]) =>
  [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))

// Bộ nhớ dài hạn: danh sách + thêm / sửa / xóa / xóa hết (ghi thẳng cache)
export function useAiMemories() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: queryKeys.aiMemories, queryFn: chatApi.memories, staleTime: 60 * 1000 })
  const set = (fn: (list: AiMemory[]) => AiMemory[]) => qc.setQueryData<AiMemory[]>(queryKeys.aiMemories, (old) => fn(old ?? []))
  const create = useMutation({ mutationFn: chatApi.createMemory, onSuccess: (m) => set((l) => [m, ...l]), onError })
  const update = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => chatApi.updateMemory(id, content),
    onSuccess: (m) => set((l) => l.map((x) => (x.id === m.id ? m : x))),
    onError
  })
  const remove = useMutation({ mutationFn: (id: string) => chatApi.deleteMemory(id), onSuccess: (_, id) => set((l) => l.filter((x) => x.id !== id)), onError })
  const clear = useMutation({ mutationFn: chatApi.clearMemories, onSuccess: () => set(() => []), onError })
  // Ghim ⇒ lên đầu danh sách (giống thứ tự server: ghim trước, mới trước)
  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => chatApi.pinMemory(id, pinned),
    onSuccess: (m) => set((l) => sortMemories(l.map((x) => (x.id === m.id ? m : x)))),
    onError
  })
  return { memories: query.data ?? [], isLoading: query.isPending, create, update, remove, clear, pin }
}

// Tác vụ tự động
export function useAiTasks() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: queryKeys.aiTasks, queryFn: chatApi.tasks, staleTime: 60 * 1000 })
  const set = (fn: (list: AiTask[]) => AiTask[]) => qc.setQueryData<AiTask[]>(queryKeys.aiTasks, (old) => fn(old ?? []))
  const upsert = (t: AiTask) => set((l) => (l.some((x) => x.id === t.id) ? l.map((x) => (x.id === t.id ? t : x)) : [...l, t]))
  const create = useMutation({ mutationFn: (body: AiTaskInput) => chatApi.createTask(body), onSuccess: upsert, onError })
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: AiTaskInput }) => chatApi.updateTask(id, body), onSuccess: upsert, onError })
  const remove = useMutation({ mutationFn: (id: string) => chatApi.deleteTask(id), onSuccess: (_, id) => set((l) => l.filter((x) => x.id !== id)), onError })
  const run = useMutation({
    mutationFn: (id: string) => chatApi.runTask(id),
    onSuccess: (t) => {
      upsert(t)
      if (t.lastStatus === 'done') toast.success('Đã chạy xong — xem kết quả trong Tin nhắn')
      else if (t.lastStatus === 'skipped') toast.info('Hết lượt N7AI hôm nay, tác vụ được bỏ qua')
      else toast.error('Tác vụ chạy lỗi')
    },
    onError
  })
  return { tasks: query.data ?? [], isLoading: query.isPending, create, update, remove, run }
}

// Bật/tắt, ghim skill (cập nhật danh sách skill trong cache)
export function useSkillState() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...state }: { id: string; enabled?: boolean; pinned?: boolean }) => chatApi.skillState(id, state),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.aiSkills }),
    onMutate: ({ id, ...state }) => {
      qc.setQueryData<AiSkill[]>(queryKeys.aiSkills, (old) => old?.map((s) => (s.id === id ? { ...s, ...state } : s)))
    },
    onError
  })
}

export function useAiUsage(enabled = true) {
  return useQuery({ queryKey: queryKeys.aiUsage, queryFn: chatApi.aiUsage, staleTime: 60 * 1000, enabled })
}
