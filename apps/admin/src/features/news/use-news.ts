import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  NewsArticlePublishInput,
  NewsConfigInput,
  NewsOverview,
  NewsSourceInput,
  NewsStatus
} from '@pu/schemas'
import { adminApi } from '@/lib/api'

export const NEWS_QUERY_KEY = ['admin', 'news']

export function useNewsOverview() {
  return useQuery({
    queryKey: NEWS_QUERY_KEY,
    queryFn: () => adminApi.get<NewsOverview>('/admin/news')
  })
}

export function useNewsMutation<TArgs, TResult = unknown>(
  fn: (args: TArgs) => Promise<TResult>,
  onSuccess?: () => void
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: NEWS_QUERY_KEY })
      onSuccess?.()
    }
  })
}

export function useFetchNews() {
  return useNewsMutation<void, { fetched: number; newItems: number }>(() =>
    adminApi.post<{ fetched: number; newItems: number }>('/admin/news/fetch')
  )
}

export function usePublishArticle() {
  return useNewsMutation(({ id, input }: { id: string; input?: NewsArticlePublishInput }) =>
    adminApi.post(`/admin/news/articles/${id}/publish`, input || {})
  )
}

export function useUpdateArticleStatus() {
  return useNewsMutation(({ id, status }: { id: string; status: NewsStatus }) =>
    adminApi.patch(`/admin/news/articles/${id}/status`, { status })
  )
}

export function useCreateSource() {
  return useNewsMutation((input: NewsSourceInput) => adminApi.post('/admin/news/sources', input))
}

export function useUpdateSource() {
  return useNewsMutation(({ id, input }: { id: number; input: Partial<NewsSourceInput> }) =>
    adminApi.patch(`/admin/news/sources/${id}`, input)
  )
}

export function useDeleteSource() {
  return useNewsMutation((id: number) => adminApi.delete(`/admin/news/sources/${id}`))
}

export function useUpdateNewsConfig() {
  return useNewsMutation((input: NewsConfigInput) => adminApi.patch('/admin/news/config', input))
}
