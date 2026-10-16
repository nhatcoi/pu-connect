'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { flattenPages } from '@/lib/post-cache'
import type { CommentItem } from '@pu/schemas'
import { toast } from 'sonner'
import { useRealtimeEvent } from '@/hooks/use-realtime-event'
import { PUAI_MENTION } from '@/lib/mention'

const INITIAL_COMMENT_LIMIT = 3
const BATCH_COMMENT_LIMIT = 10

// Một trang: bình luận gốc + toàn bộ phản hồi của chúng (API phân trang theo bình luận gốc)
interface CommentPage {
  items: CommentItem[]
  hasMore: boolean
  nextOffset: number
  remainingCount: number
  total: number
}

type CommentsData = InfiniteData<CommentPage, number>

async function fetchCommentPage(postId: string, offset: number): Promise<CommentPage> {
  const limit = offset === 0 ? INITIAL_COMMENT_LIMIT : BATCH_COMMENT_LIMIT
  const res = await apiClient<any>(`/posts/${postId}/comments?limit=${limit}&offset=${offset}`)
  const items: CommentItem[] = Array.isArray(res?.data) ? res.data : res?.data?.data || []
  return {
    items,
    hasMore: res?.hasMore ?? res?.data?.hasMore ?? false,
    nextOffset: res?.nextOffset ?? offset + items.filter((c) => !c.parentId).length,
    remainingCount: res?.remainingCount ?? res?.data?.remainingCount ?? 0,
    total: res?.total ?? res?.data?.total ?? items.length
  }
}

// Bình luận của một bài: cache theo postId (đóng/mở lại hoặc quay lại trang hiện ngay)
export function useComments(postId: string, initialOpen = false) {
  const queryClient = useQueryClient()
  const key = useMemo(() => queryKeys.comments(postId), [postId])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchCommentPage(postId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: initialOpen && !!postId,
    staleTime: 30 * 1000
  })

  const comments = flattenPages(query.data)
  const lastPage = query.data?.pages[query.data.pages.length - 1]
  const commentsRef = useRef<CommentItem[]>([])
  commentsRef.current = comments

  // Sửa dữ liệu cache: áp hàm cho danh sách bình luận của từng trang, chỉnh tổng số
  const update = useCallback(
    (fn: (items: CommentItem[]) => CommentItem[], totalDelta = 0) => {
      queryClient.setQueryData<CommentsData>(key, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({ ...p, items: fn(p.items), total: Math.max(0, p.total + totalDelta) }))
            }
          : old
      )
    },
    [queryClient, key]
  )

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const fetchMoreComments = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return
    try {
      await fetchNextPage()
    } catch {
      toast.error('Không thể tải thêm bình luận')
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // PU AI trả lời xong (server báo người hỏi) ⇒ tải lại bình luận của bài
  useRealtimeEvent<{ postId: string }>('comments.changed', (e) => {
    if (e.postId === postId) void queryClient.invalidateQueries({ queryKey: key })
  })

  const addComment = useCallback(
    async (content: string, parentId?: string, mediaUrls: string[] = []) => {
      if (!content.trim()) return null
      setIsSubmitting(true)
      try {
        const res = await apiClient<{ success: boolean; data: CommentItem }>(`/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ content: content.trim(), parentId, mediaUrls })
        })
        if (res?.data) {
          const created = res.data
          if (PUAI_MENTION.test(created.content)) toast.info('PU AI đang soạn câu trả lời…')
          // Chưa mở bình luận lần nào ⇒ chưa có cache: tạo trang đầu chứa bình luận mới
          if (!queryClient.getQueryData(key)) {
            queryClient.setQueryData<CommentsData>(key, {
              pages: [{ items: [created], hasMore: false, nextOffset: 1, remainingCount: 0, total: 1 }],
              pageParams: [0]
            })
          } else {
            queryClient.setQueryData<CommentsData>(key, (old) => {
              if (!old) return old
              const pages = old.pages.map((p) => ({ ...p, total: p.total + 1 }))
              const last = pages.length - 1
              pages[last] = {
                ...pages[last],
                items: [...pages[last].items, created],
                // Bình luận gốc mới làm lệch offset phân trang theo gốc
                nextOffset: created.parentId ? pages[last].nextOffset : pages[last].nextOffset + 1
              }
              return { ...old, pages }
            })
          }
          return created
        }
      } catch (err: any) {
        toast.error(err.message || 'Không thể gửi bình luận')
      } finally {
        setIsSubmitting(false)
      }
      return null
    },
    [postId, queryClient, key]
  )

  const toggleLike = useCallback(
    async (commentId: string) => {
      const flip = (items: CommentItem[]) =>
        items.map((c) =>
          c.id === commentId
            ? {
                ...c,
                isLikedByMe: !c.isLikedByMe,
                likesCount: !c.isLikedByMe ? c.likesCount + 1 : Math.max(0, c.likesCount - 1)
              }
            : c
        )
      update(flip) // lạc quan
      try {
        await apiClient(`/comments/${commentId}/like`, { method: 'POST' })
      } catch {
        update(flip) // hoàn tác
        toast.error('Không thể thực hiện tương tác')
      }
    },
    [update]
  )

  const acceptSolution = useCallback(
    async (commentId: string) => {
      try {
        const res = await apiClient<{ isSolution: boolean; message: string }>(
          `/comments/${commentId}/accept-solution`,
          { method: 'POST' }
        )
        if (res) {
          update((items) => items.map((c) => ({ ...c, isSolution: c.id === commentId ? res.isSolution : false })))
          toast.success(res.message)
        }
      } catch (err: any) {
        toast.error(err.message || 'Không thể duyệt câu trả lời')
      }
    },
    [update]
  )

  // Sửa nội dung; trả về true khi lưu thành công (composer đóng chế độ sửa)
  const editComment = useCallback(
    async (commentId: string, content: string) => {
      try {
        const res = await apiClient<{ data: { id: string; content: string; editedAt: string } }>(
          `/comments/${commentId}`,
          { method: 'PATCH', body: JSON.stringify({ content }) }
        )
        const { content: saved, editedAt } = res.data
        update((items) => items.map((c) => (c.id === commentId ? { ...c, content: saved, editedAt } : c)))
        return true
      } catch (err: any) {
        toast.error(err.message || 'Không thể sửa bình luận')
        return false
      }
    },
    [update]
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      try {
        await apiClient(`/comments/${commentId}`, { method: 'DELETE' })
        // Xóa cả phản hồi con (server ON DELETE CASCADE)
        const gone = new Set([commentId])
        let grew = true
        while (grew) {
          grew = false
          for (const c of commentsRef.current) {
            if (c.parentId && gone.has(c.parentId) && !gone.has(c.id)) {
              gone.add(c.id)
              grew = true
            }
          }
        }
        update((items) => items.filter((c) => !gone.has(c.id)), -gone.size)
        toast.success('Đã xóa bình luận')
      } catch (err: any) {
        toast.error(err.message || 'Không thể xóa bình luận')
      }
    },
    [update]
  )

  return {
    comments,
    isLoading: initialOpen && query.isPending,
    isLoadingMore: isFetchingNextPage,
    isSubmitting,
    // Đã có dữ liệu thật từ server (tránh báo tổng = 0 trước khi tải xong)
    isLoaded: !!query.data,
    totalCount: lastPage?.total ?? 0,
    hasMore: !!hasNextPage,
    remainingCount: lastPage?.remainingCount ?? 0,
    fetchComments: query.refetch,
    fetchMoreComments,
    addComment,
    toggleLike,
    acceptSolution,
    editComment,
    deleteComment
  }
}
