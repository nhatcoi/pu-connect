'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { DocumentCollectionInput } from '@pu/schemas'
import { useAppStore } from '@/store'
import { errorMessage } from '@/lib/api-client'
import {
  collectionMembership,
  createCollection,
  deleteCollection,
  getCollection,
  getCoursePath,
  listCollections,
  rateDocument,
  setCollectionDocument,
  unrateDocument,
  updateCollection,
  type CollectionScope
} from '@/lib/document-api'
import { queryKeys } from '@/lib/query-keys'

// Lộ trình học của 1 môn (tài liệu theo thứ tự ôn + đề thi theo năm)
export function useCoursePath(course: string) {
  return useQuery({ queryKey: queryKeys.coursePath(course), queryFn: () => getCoursePath(course), staleTime: 60_000 })
}

// Chấm sao (value = null ⇒ bỏ chấm): làm mới chi tiết + các danh sách đang hiện sao
export function useRateDocument(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: number | null) => (value === null ? unrateDocument(documentId) : rateDocument(documentId, value)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documentDetail(documentId) })
      void queryClient.invalidateQueries({ queryKey: ['document-browse'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Không chấm sao được'))
  })
}

export function useCollections(scope: CollectionScope) {
  const user = useAppStore((s) => s.user)
  const query = useInfiniteQuery({
    queryKey: queryKeys.collections(scope),
    queryFn: ({ pageParam }) => listCollections(scope, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: scope === 'public' || !!user,
    staleTime: 30_000
  })
  return { ...query, items: query.data?.pages.flatMap((p) => p.data) ?? [] }
}

export function useCollection(id: string) {
  return useQuery({ queryKey: queryKeys.collection(id), queryFn: () => getCollection(id), retry: false })
}

// Bộ của mình + đã chứa tài liệu này chưa (chỉ tải khi mở menu)
export function useCollectionMembership(documentId: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.collectionMembership(documentId), queryFn: () => collectionMembership(documentId), enabled })
}

// Tạo / sửa / xóa bộ, thêm / bỏ tài liệu ⇒ làm mới mọi truy vấn bộ sưu tập
export function useCollectionActions() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.collectionsAll })
  const onError = (err: unknown) => toast.error(errorMessage(err, 'Không lưu được, thử lại nhé'))
  return {
    create: useMutation({ mutationFn: (body: DocumentCollectionInput) => createCollection(body), onSuccess: refresh, onError }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: DocumentCollectionInput }) => updateCollection(id, body), onSuccess: refresh, onError }),
    remove: useMutation({ mutationFn: (id: string) => deleteCollection(id), onSuccess: refresh, onError }),
    setDocument: useMutation({
      mutationFn: ({ id, documentId, add }: { id: string; documentId: string; add: boolean }) => setCollectionDocument(id, documentId, add),
      onSuccess: refresh,
      onError
    })
  }
}
