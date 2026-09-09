'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { Community, PostItem } from '@pu/schemas'
import { toast } from 'sonner'

export function useCommunity(slug: string, initialSort: 'hot' | 'new' | 'top' = 'hot') {
  const [community, setCommunity] = useState<Community | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [sort, setSort] = useState<'hot' | 'new' | 'top'>(initialSort)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [isJoining, setIsJoining] = useState(false)

  // 1. Fetch Community Details & Initial Posts
  const fetchCommunityData = useCallback(async () => {
    if (!slug) return
    setIsLoading(true)
    try {
      const res = await apiClient<{ success: boolean; data: PostItem[]; community: Community; hasMore: boolean; nextOffset: number }>(
        `/communities/${slug}/posts?limit=10&offset=0&sort=${sort}`
      )
      setCommunity(res.community)
      setPosts(res.data)
      setHasMore(res.hasMore)
      setNextOffset(res.nextOffset)
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải thông tin cộng đồng')
    } finally {
      setIsLoading(false)
    }
  }, [slug, sort])

  useEffect(() => {
    fetchCommunityData()
  }, [fetchCommunityData])

  // 2. Fetch More Posts (Infinite Scroll)
  const fetchMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return
    setIsLoadingMore(true)
    try {
      const res = await apiClient<{ success: boolean; data: PostItem[]; hasMore: boolean; nextOffset: number }>(
        `/communities/${slug}/posts?limit=10&offset=${nextOffset}&sort=${sort}`
      )
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newPosts = res.data.filter((p) => !existingIds.has(p.id))
        return [...prev, ...newPosts]
      })
      setHasMore(res.hasMore)
      setNextOffset(res.nextOffset)
    } catch (err: any) {
      toast.error('Không thể tải thêm bài viết')
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasMore, isLoadingMore, isLoading, slug, nextOffset, sort])

  // 3. Toggle Join Community
  const toggleJoin = useCallback(async () => {
    if (!community || isJoining) return
    setIsJoining(true)
    try {
      const res = await apiClient<{ isMember: boolean; membersCount: number; message: string }>(
        `/communities/${slug}/join`,
        { method: 'POST' }
      )
      setCommunity((prev) =>
        prev
          ? {
              ...prev,
              isMember: res.isMember,
              membersCount: res.membersCount
            }
          : null
      )
      toast.success(res.message)
    } catch (err: any) {
      toast.error(err.message || 'Thao tác không thành công')
    } finally {
      setIsJoining(false)
    }
  }, [community, isJoining, slug])

  // 4. Add Post Locally
  const addPost = useCallback((newPost: PostItem) => {
    setPosts((prev) => [newPost, ...prev])
    setCommunity((prev) => (prev ? { ...prev, postsCount: prev.postsCount + 1 } : null))
  }, [])

  return {
    community,
    posts,
    sort,
    setSort,
    isLoading,
    isLoadingMore,
    hasMore,
    fetchMore,
    toggleJoin,
    isJoining,
    addPost,
    refresh: fetchCommunityData
  }
}
