'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import type { AiLibraryKind } from '@pu/schemas'
import { queryKeys } from '@/lib/query-keys'
import { chatApi } from './api'

// Thư viện N7AI theo loại, tùy chọn 1 thread (keyset theo id tin); tin mới có tệp / học liệu ⇒ realtime làm mới
export function useAiLibrary(kind: AiLibraryKind, threadId?: string) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.aiLibrary(kind, threadId),
    queryFn: ({ pageParam, signal }) => chatApi.aiLibrary(kind, threadId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60 * 1000
  })
  const items = query.data?.pages.flatMap((p) => p.data) ?? []
  return { ...query, items }
}
