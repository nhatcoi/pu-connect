'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AiNote, AiNoteSummary, AiNoteUpdateInput } from '@pu/schemas'
import { useN7AiLayout } from '@/components/n7ai/layout/n7ai-layout-store'
import { API_BASE_URL } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

const toSummary = (n: AiNote): AiNoteSummary => ({ id: n.id, parentId: n.parentId, conversationId: n.conversationId, title: n.title, pinned: n.pinned, position: n.position, updatedAt: n.updatedAt })
const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại')

// Danh sách ghi chú (không kèm nội dung) cho cây trang
export function useAiNotes(enabled = true) {
  const query = useQuery({ queryKey: queryKeys.aiNotes, queryFn: chatApi.aiNotes, staleTime: 60 * 1000, enabled })
  return { notes: query.data ?? [], isPending: query.isPending }
}

export function useAiNote(id: string | null) {
  return useQuery({ queryKey: queryKeys.aiNote(id ?? ''), queryFn: () => chatApi.aiNote(id as string), enabled: !!id, staleTime: 30 * 1000 })
}

// Ghi vào cache: danh sách (tiêu đề / ghim / cha) + chi tiết (nội dung)
export function useAiNoteMutations() {
  const qc = useQueryClient()
  const put = (n: AiNote) => {
    qc.setQueryData<AiNote>(queryKeys.aiNote(n.id), n)
    qc.setQueryData<AiNoteSummary[]>(queryKeys.aiNotes, (list) => {
      const s = toSummary(n)
      return list ? (list.some((x) => x.id === n.id) ? list.map((x) => (x.id === n.id ? s : x)) : [s, ...list]) : [s]
    })
  }
  const create = useMutation({
    mutationFn: (input: { title?: string; content?: string; parentId?: string | null; conversationId?: string | null }) => chatApi.createAiNote(input),
    onSuccess: put,
    onError
  })
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & AiNoteUpdateInput) => chatApi.updateAiNote(id, input),
    onSuccess: put,
    onError
  })
  const append = useMutation({ mutationFn: ({ id, markdown }: { id: string; markdown: string }) => chatApi.appendAiNote(id, markdown), onSuccess: put, onError })
  const remove = useMutation({
    mutationFn: (id: string) => chatApi.deleteAiNote(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.aiNotes }),
    onError
  })
  return { create, update, append, remove }
}

// Tải tệp xuất (.md / .docx) kèm cookie phiên
export async function downloadAiNote(id: string, format: 'md' | 'docx', fallbackName: string) {
  const res = await fetch(`${API_BASE_URL}/ai/notes/${id}/export?format=${format}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Không xuất được ghi chú')
  const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name ? decodeURIComponent(name) : `${fallbackName || 'ghi-chu'}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

// "Thêm vào ghi chú" ở tin N7AI: chèn vào ghi chú đang mở (hoặc ghi chú gần nhất; chưa có thì tạo mới) rồi mở tab Ghi chú
export function useAddToNote() {
  const qc = useQueryClient()
  const { create, append } = useAiNoteMutations()
  return async (markdown: string, conversationId: string | null) => {
    const layout = useN7AiLayout.getState()
    const list: AiNoteSummary[] = qc.getQueryData<AiNoteSummary[]>(queryKeys.aiNotes) ?? (await qc.fetchQuery({ queryKey: queryKeys.aiNotes, queryFn: chatApi.aiNotes }))
    const target = list.find((n) => n.id === layout.activeNoteId)?.id ?? list[0]?.id ?? null
    layout.setPanelOpen(true)
    layout.setPanelTab('notes')
    if (!target) {
      layout.setActiveNoteId((await create.mutateAsync({ content: markdown, conversationId })).id)
      return
    }
    layout.setActiveNoteId(target)
    if (layout.openNoteId === target) layout.requestAppend(target, markdown) // trình soạn đang mở ⇒ chèn tại chỗ, tự lưu như gõ tay
    else await append.mutateAsync({ id: target, markdown })
  }
}
