'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import type { CommentItem } from '@pu/schemas'
import { toast } from 'sonner'

const INITIAL_COMMENT_LIMIT = 3
const BATCH_COMMENT_LIMIT = 10

export function useComments(postId: string, initialOpen = false) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [remainingCount, setRemainingCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const offsetRef = useRef(0)

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    offsetRef.current = 0
    try {
      const res = await apiClient<{
        success: boolean
        data: CommentItem[]
        total: number
        hasMore: boolean
        remainingCount: number
      }>(`/posts/${postId}/comments?limit=${INITIAL_COMMENT_LIMIT}&offset=0`)

      if (res) {
        const items = Array.isArray(res.data) ? res.data : (res.data as any)?.data || []
        setComments(items)
        setTotalCount(res.total ?? (res.data as any)?.total ?? items.length)
        setHasMore(res.hasMore ?? (res.data as any)?.hasMore ?? false)
        setRemainingCount(res.remainingCount ?? (res.data as any)?.remainingCount ?? 0)
        offsetRef.current = items.length
      }
    } catch (err: any) {
      // Quiet fail
    } finally {
      setIsLoading(false)
    }
  }, [postId])

  const fetchMoreComments = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const res = await apiClient<any>(
        `/posts/${postId}/comments?limit=${BATCH_COMMENT_LIMIT}&offset=${offsetRef.current}`
      )

      const newItems: CommentItem[] = res
        ? Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.data || []
        : []

      if (newItems.length > 0) {
        // Deduplicate
        setComments((prev) => {
          const currentIds = new Set(prev.map((c) => c.id))
          const filtered = newItems.filter((c) => !currentIds.has(c.id))
          return [...prev, ...filtered]
        })
        setTotalCount(res.total ?? (res.data as any)?.total ?? totalCount)
        setHasMore(res.hasMore ?? (res.data as any)?.hasMore ?? false)
        setRemainingCount(res.remainingCount ?? (res.data as any)?.remainingCount ?? 0)
        offsetRef.current += newItems.length
      } else {
        setHasMore(false)
        setRemainingCount(0)
      }
    } catch (err: any) {
      toast.error('Không thể tải thêm bình luận')
    } finally {
      setIsLoadingMore(false)
    }
  }, [postId, isLoadingMore, hasMore])

  useEffect(() => {
    if (initialOpen) {
      fetchComments()
    }
  }, [fetchComments, initialOpen])

  const addComment = useCallback(
    async (content: string, parentId?: string, mediaUrls: string[] = []) => {
      if (!content.trim()) return null
      setIsSubmitting(true)
      try {
        const res = await apiClient<{ success: boolean; data: CommentItem }>(
          `/posts/${postId}/comments`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: content.trim(),
              parentId,
              mediaUrls
            })
          }
        )

        if (res && res.data) {
          setComments((prev) => [...prev, res.data])
          setTotalCount((prev) => prev + 1)
          offsetRef.current += 1
          toast.success('Đã gửi phản hồi')
          return res.data
        }
      } catch (err: any) {
        toast.error(err.message || 'Không thể gửi bình luận')
      } finally {
        setIsSubmitting(false)
      }
      return null
    },
    [postId]
  )

  const toggleLike = useCallback(async (commentId: string) => {
    // Optimistic toggle
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const newLiked = !c.isLikedByMe
          return {
            ...c,
            isLikedByMe: newLiked,
            likesCount: newLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1)
          }
        }
        return c
      })
    )

    try {
      await apiClient(`/comments/${commentId}/like`, { method: 'POST' })
    } catch (err: any) {
      toast.error('Không thể thực hiện tương tác')
    }
  }, [])

  const acceptSolution = useCallback(async (commentId: string) => {
    try {
      const res = await apiClient<{ isSolution: boolean; message: string }>(
        `/comments/${commentId}/accept-solution`,
        { method: 'POST' }
      )

      if (res) {
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            isSolution: c.id === commentId ? res.isSolution : false
          }))
        )
        toast.success(res.message)
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể duyệt câu trả lời')
    }
  }, [])

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      await apiClient(`/comments/${commentId}`, { method: 'DELETE' })
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setTotalCount((prev) => Math.max(0, prev - 1))
      toast.success('Đã xóa bình luận')
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa bình luận')
    }
  }, [])

  return {
    comments,
    isLoading,
    isLoadingMore,
    isSubmitting,
    totalCount,
    hasMore,
    remainingCount,
    fetchComments,
    fetchMoreComments,
    addComment,
    toggleLike,
    acceptSolution,
    deleteComment
  }
}
