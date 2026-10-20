import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  ReviewGrade,
  StudyAttemptRecord,
  StudyItem,
  StudySetDetail,
  StudySetDraft,
  StudySetDraftInput,
  StudySetInput,
  StudySetSummary,
  StudyStats,
  StudyToolKind,
  StudyToolsOverview
} from '@pu/schemas'
import { apiClient, errorMessage } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

type Envelope<T> = { success: boolean; data: T }
const unwrap = async <T>(p: Promise<Envelope<T>>) => (await p).data
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

// REST client Công cụ học tập (apps/api/src/modules/study-tools)
export const toolsApi = {
  overview: () => unwrap(apiClient<Envelope<StudyToolsOverview>>('/tools/overview')),
  stats: () => unwrap(apiClient<Envelope<StudyStats>>('/tools/stats')),
  list: (kind: StudyToolKind, q: string) => unwrap(apiClient<Envelope<StudySetSummary[]>>(`/tools/sets?kind=${kind}&q=${encodeURIComponent(q)}`)),
  get: (id: string) => unwrap(apiClient<Envelope<StudySetDetail>>(`/tools/sets/${id}`)),
  create: (body: StudySetInput) => unwrap(apiClient<Envelope<StudySetDetail>>('/tools/sets', json('POST', body))),
  update: (id: string, body: StudySetInput) => unwrap(apiClient<Envelope<StudySetDetail>>(`/tools/sets/${id}`, json('PATCH', body))),
  remove: (id: string) => apiClient(`/tools/sets/${id}`, json('DELETE')),
  draft: (body: StudySetDraftInput) => unwrap(apiClient<Envelope<StudySetDraft>>('/tools/sets/draft', json('POST', body))),
  review: (id: string, itemId: string, grade: ReviewGrade) =>
    unwrap(apiClient<Envelope<{ item: StudyItem; dueCount: number }>>(`/tools/sets/${id}/review`, json('POST', { itemId, grade }))),
  attempt: (id: string, correct: number, total: number, seconds?: number) =>
    unwrap(apiClient<Envelope<StudySetSummary>>(`/tools/sets/${id}/attempts`, json('POST', { correct, total, seconds }))),
  attempts: (id: string) => unwrap(apiClient<Envelope<StudyAttemptRecord[]>>(`/tools/sets/${id}/attempts`))
}

export function useToolsOverview() {
  return useQuery({ queryKey: queryKeys.toolsOverview, queryFn: toolsApi.overview, staleTime: 30_000 })
}

// Chuỗi ngày học, lịch nhiệt, thẻ đến hạn 7 ngày tới
export function useStudyStats() {
  return useQuery({ queryKey: queryKeys.toolStats, queryFn: toolsApi.stats, staleTime: 60_000 })
}

// Lịch sử các lần làm quiz của 1 bộ (mới trước)
export function useQuizAttempts(setId: string) {
  return useQuery({ queryKey: queryKeys.toolAttempts(setId), queryFn: () => toolsApi.attempts(setId), staleTime: 30_000 })
}

export function useStudySets(kind: StudyToolKind, q: string) {
  return useQuery({ queryKey: queryKeys.toolSets(kind, q), queryFn: () => toolsApi.list(kind, q.trim()), placeholderData: keepPreviousData, staleTime: 30_000 })
}

export function useStudySet(id: string | null) {
  return useQuery({ queryKey: queryKeys.toolSet(id ?? ''), queryFn: () => toolsApi.get(id!), enabled: !!id })
}

// Tạo / sửa / xóa bộ ⇒ làm mới danh sách & tổng quan
export function useStudySetActions() {
  const qc = useQueryClient()
  const refresh = (detail?: StudySetDetail) => {
    if (detail) qc.setQueryData(queryKeys.toolSet(detail.id), detail)
    void qc.invalidateQueries({ queryKey: queryKeys.toolsAll, predicate: (q) => q.queryKey[1] !== 'set' })
  }
  const onError = (err: unknown) => toast.error(errorMessage(err, 'Không lưu được, thử lại nhé'))
  return {
    create: useMutation({ mutationFn: toolsApi.create, onSuccess: refresh, onError }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: StudySetInput }) => toolsApi.update(id, body), onSuccess: refresh, onError }),
    remove: useMutation({
      mutationFn: toolsApi.remove,
      onSuccess: (_, id) => {
        qc.removeQueries({ queryKey: queryKeys.toolSet(id) })
        refresh()
      },
      onError
    }),
    // Bản nháp N7AI tốn 1 lượt ⇒ cập nhật quota
    draft: useMutation({
      mutationFn: toolsApi.draft,
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: queryKeys.aiQuota })
        void qc.invalidateQueries({ queryKey: queryKeys.aiUsage })
      },
      onError: (err) => toast.error(errorMessage(err, 'N7AI chưa tạo được, thử lại nhé'))
    })
  }
}
