'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { errorMessage } from '@/lib/api-client'
import {
  browseDocuments,
  getDocumentDetail,
  librarySavedIds,
  listLibrary,
  listLibraryFolders,
  removeFromLibrary,
  saveToLibrary,
  type BrowseFilters,
  type LibraryScope
} from '@/lib/document-api'
import { queryKeys } from '@/lib/query-keys'

// Trang "Tài liệu": kho chung có lọc, cuộn vô hạn
export function useDocumentBrowse(filters: BrowseFilters, enabled = true) {
  const query = useInfiniteQuery({
    enabled,
    queryKey: queryKeys.documentBrowse(filters),
    queryFn: ({ pageParam }) => browseDocuments(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60 * 1000
  })
  return { ...query, items: query.data?.pages.flatMap((p) => p.data) ?? [] }
}

export function useDocumentDetail(id: string) {
  return useQuery({ queryKey: queryKeys.documentDetail(id), queryFn: () => getDocumentDetail(id), retry: false })
}

// Kho cá nhân (đã lưu / tôi đăng), lọc thư mục + tìm theo tên
export function useLibrary(scope: LibraryScope, folder?: string, q?: string) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.library(scope, folder, q),
    queryFn: ({ pageParam }) => listLibrary(scope, folder, q, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined
  })
  return { ...query, items: query.data?.pages.flatMap((p) => p.data) ?? [] }
}

export function useLibraryFolders() {
  const user = useAppStore((s) => s.user)
  return useQuery({ queryKey: queryKeys.libraryFolders, queryFn: listLibraryFolders, enabled: !!user })
}

// Id tài liệu đã lưu (1 truy vấn cho mọi nút "Lưu" trên trang); chưa đăng nhập ⇒ rỗng
export function useSavedDocumentIds() {
  const user = useAppStore((s) => s.user)
  const { data } = useQuery({ queryKey: queryKeys.librarySavedIds, queryFn: librarySavedIds, enabled: !!user, staleTime: 5 * 60 * 1000 })
  return new Set(data ?? [])
}

// Lưu / bỏ lưu: cập nhật ngay danh sách id, rồi làm mới các danh sách kho
export function useToggleSaveDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId, saved }: { documentId: string; saved: boolean }) => {
      if (saved) await removeFromLibrary(documentId)
      else await saveToLibrary(documentId)
    },
    onMutate: ({ documentId, saved }) => {
      queryClient.setQueryData<string[]>(queryKeys.librarySavedIds, (ids = []) => (saved ? ids.filter((i) => i !== documentId) : [...ids, documentId]))
    },
    onSuccess: (_data, { saved }) => toast.success(saved ? 'Đã bỏ khỏi kho của bạn' : 'Đã lưu vào kho của bạn'),
    onError: (err) => toast.error(errorMessage(err, 'Không lưu được tài liệu')),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.libraryAll })
  })
}
