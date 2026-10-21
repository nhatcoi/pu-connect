'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AiSource, AiSourceInput } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

// Tài liệu của 1 cuộc trò chuyện (threadId) hoặc của thư viện (bỏ trống) + thêm / xóa
export function useAiSources(threadId?: string) {
  const qc = useQueryClient()
  const key = queryKeys.aiSources(threadId)
  const query = useQuery({ queryKey: key, queryFn: () => chatApi.aiSources(threadId), staleTime: 60 * 1000 })
  const onError = (err: Error) => toast.error(err.message || 'Thao tác thất bại')

  const add = useMutation({
    // threadId của hook luôn được gắn vào, ngoại trừ yêu cầu chép tài liệu (đã có threadId đích)
    mutationFn: (input: AiSourceInput) => chatApi.addAiSource(input.type === 'copy' ? input : { ...input, threadId }),
    onSuccess: (source) => qc.setQueryData<AiSource[]>(key, (list) => [source, ...(list ?? []).filter((s) => s.id !== source.id)]),
    onError
  })
  // Bật / tắt cho N7AI đọc: cập nhật ngay trên danh sách, lỗi thì hoàn lại
  const setInContext = useMutation({
    mutationFn: ({ id, inContext }: { id: string; inContext: boolean }) => chatApi.patchAiSource(id, { inContext }),
    onMutate: ({ id, inContext }) => {
      const before = qc.getQueryData<AiSource[]>(key)
      qc.setQueryData<AiSource[]>(key, (list) => (list ?? []).map((s) => (s.id === id ? { ...s, inContext } : s)))
      return { before }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before)
      onError(err)
    }
  })
  const remove = useMutation({
    mutationFn: (id: string) => chatApi.deleteAiSource(id),
    onSuccess: (_, id) => qc.setQueryData<AiSource[]>(key, (list) => (list ?? []).filter((s) => s.id !== id)),
    onError
  })
  return { sources: query.data ?? [], isPending: query.isPending, add, remove, setInContext }
}

// Nội dung chữ của tài liệu (văn bản dán, trang web, YouTube)
export function useAiSourceContent(id: string) {
  return useQuery({ queryKey: queryKeys.aiSourceContent(id), queryFn: () => chatApi.aiSourceContent(id), staleTime: Infinity })
}
