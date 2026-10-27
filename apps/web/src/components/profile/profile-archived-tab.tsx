'use client'

import React, { useEffect, useRef } from 'react'
import { Archive, Loader2 } from 'lucide-react'
import { PostCard } from '@/components/social/post-card'
import { PostListSkeleton } from '@/components/skeletons/feed-skeleton'
import { usePosts } from '@/hooks/use-posts'

// Mục Lưu trữ (chỉ chủ hồ sơ): bài đã gỡ khỏi bảng tin / hồ sơ, bỏ lưu trữ để hiện lại
export function ProfileArchivedTab() {
  const { posts, isLoading, isError, isLoadingMore, hasMore, fetchMore } = usePosts({ feedType: 'archived' })
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && fetchMore(), { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchMore, posts.length])

  return (
    <div className="space-y-2.5 px-2 sm:px-0">
      <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-xs text-muted-foreground">
        <Archive className="h-3.5 w-3.5 shrink-0" />
        <span>Chỉ bạn thấy mục này. Bài lưu trữ không hiện trên bảng tin, hồ sơ và tìm kiếm; bình luận và lượt thích vẫn được giữ.</span>
      </div>

      {isLoading ? (
        <PostListSkeleton count={2} />
      ) : isError ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Không tải được mục này. Thử lại sau nhé.</div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Archive className="mx-auto mb-2.5 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Chưa có bài viết nào được lưu trữ</p>
          <p className="mt-1 text-xs">Chọn Lưu trữ ở menu ⋯ của bài để cất bài đi mà không xóa.</p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} variant="card" />
          ))}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!hasMore && !isLoadingMore && posts.length > 5 && <span className="text-xs text-muted-foreground">Đã hiển thị tất cả</span>}
          </div>
        </>
      )}
    </div>
  )
}
