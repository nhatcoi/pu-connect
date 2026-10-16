'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import type { AiLibraryKind } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

// Thư viện PU AI theo loại (keyset theo id tin); tin mới có tệp / học liệu ⇒ realtime làm mới
export function useAiLibrary(kind: AiLibraryKind) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.aiLibrary(kind),
    queryFn: ({ pageParam, signal }) => chatApi.aiLibrary(kind, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60 * 1000
  })
  const items = query.data?.pages.flatMap((p) => p.data) ?? []
  return { ...query, items }
}
