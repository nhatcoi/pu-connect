'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import type { PostItem } from '@pu/schemas'
import { toast } from 'sonner'

const PAGE_SIZE = 10

interface UsePostsOptions {
  selectedTag?: string | null
  feedType?: 'for_you' | 'following' | 'qa' | 'courses' | 'explore' | 'bookmarks'
}

export function usePosts(options?: string | UsePostsOptions | null) {
  const selectedTag = typeof options === 'string' ? options : options?.selectedTag || null
  const feedType = typeof options === 'object' && options ? options.feedType || 'for_you' : 'for_you'

  const posts = useAppStore((state) => state.posts)
  const setPosts = useAppStore((state) => state.setPosts)
  const toggleLikePost = useAppStore((state) => state.toggleLikePost)

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  const offsetRef = useRef(0)

  const fetchPosts = useCallback(async () => {
    setIsLoading(true)
    offsetRef.current = 0
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', '0')
      if (selectedTag) params.set('tag', selectedTag)
      if (feedType) params.set('feedType', feedType)

      const res = await apiClient<any>(`/posts?${params.toString()}`)

      let items: PostItem[] = []
      let totalCount = 0
      let more = false

      if (res) {
        if (Array.isArray(res.data)) {
          items = res.data
          totalCount = res.total ?? res.data.length
          more = res.hasMore ?? false
        } else if (res.data && typeof res.data === 'object' && Array.isArray(res.data.data)) {
          items = res.data.data
          totalCount = res.data.total ?? items.length
          more = res.data.hasMore ?? false
        } else if (Array.isArray(res)) {
          items = res
          totalCount = res.length
          more = false
        }
      }

      setPosts(items)
      setTotal(totalCount)
      setHasMore(more)
      offsetRef.current = items.length
    } catch (err: any) {
      // Quiet fail
    } finally {
      setIsLoading(false)
    }
  }, [setPosts, selectedTag, feedType])

  const fetchMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offsetRef.current))
      if (selectedTag) params.set('tag', selectedTag)
      if (feedType) params.set('feedType', feedType)

      const res = await apiClient<any>(`/posts?${params.toString()}`)

      let newItems: PostItem[] = []
      let totalCount = total
      let more = false

      if (res) {
        if (Array.isArray(res.data)) {
          newItems = res.data
          totalCount = res.total ?? total
          more = res.hasMore ?? false
        } else if (res.data && typeof res.data === 'object' && Array.isArray(res.data.data)) {
          newItems = res.data.data
          totalCount = res.data.total ?? total
          more = res.data.hasMore ?? false
        } else if (Array.isArray(res)) {
          newItems = res
          more = false
        }
      }

      if (newItems.length > 0) {
        // Deduplicate
        const currentIds = new Set(posts.map((p) => p.id))
        const filteredNew = newItems.filter((p) => !currentIds.has(p.id))
        setPosts([...posts, ...filteredNew])
        setTotal(totalCount)
        setHasMore(more)
        offsetRef.current += newItems.length
      } else {
        setHasMore(false)
      }
    } catch (err: any) {
      toast.error('Không thể tải thêm bài viết')
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, posts, total, setPosts, selectedTag, feedType])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const toggleLike = useCallback(
    async (postId: string) => {
      toggleLikePost(postId)
      try {
        await apiClient(`/posts/${postId}/like`, { method: 'POST' })
      } catch (err: any) {
        toggleLikePost(postId)
        toast.error('Không thể thực hiện tương tác')
      }
    },
    [toggleLikePost]
  )

  return {
    posts,
    isLoading,
    isLoadingMore,
    hasMore,
    total,
    refetch: fetchPosts,
    fetchMore,
    toggleLike
  }
}
