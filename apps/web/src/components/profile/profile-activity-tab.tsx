'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bookmark, Heart, Loader2, Lock, MessageCircle } from 'lucide-react'
import type { ProfileActivityType } from '@pu/schemas'
import { PostCard } from '@/components/social/post-card'
import { PostListSkeleton } from '@/components/skeletons/feed-skeleton'
import { useProfileActivity } from '@/hooks/use-profile-activity'

const EMPTY: Record<ProfileActivityType, { icon: typeof Heart; mine: string; theirs: (u: string) => string }> = {
  liked: { icon: Heart, mine: 'Bạn chưa thích bài viết nào', theirs: (u) => `@${u} chưa thích bài viết nào` },
  saved: { icon: Bookmark, mine: 'Bạn chưa lưu bài viết nào', theirs: (u) => `@${u} chưa lưu bài viết nào` },
  commented: { icon: MessageCircle, mine: 'Bạn chưa bình luận bài viết nào', theirs: (u) => `@${u} chưa bình luận bài viết nào` }
}

interface ProfileActivityTabProps {
  username: string
  type: ProfileActivityType
  isOwner: boolean
  // Chủ hồ sơ: mục này đang ẩn với người khác
  isPrivateToOthers: boolean
}

// Danh sách bài theo hoạt động (đã thích / đã lưu / đã bình luận), cuộn vô hạn
export function ProfileActivityTab({ username, type, isOwner, isPrivateToOthers }: ProfileActivityTabProps) {
  const { posts, isLoading, isError, isLoadingMore, hasMore, fetchMore } = useProfileActivity(username, type, true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && fetchMore(), { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchMore, posts.length])

  const empty = EMPTY[type]
  const Icon = empty.icon

  return (
    <div className="space-y-2.5 px-2 sm:px-0">
      {/* Chủ hồ sơ biết mục nào chỉ mình thấy, đổi nhanh trong Cài đặt */}
      {isOwner && (
        <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {isPrivateToOthers ? 'Chỉ bạn thấy mục này.' : 'Mọi người xem được mục này.'}
          </span>
          <Link href="/settings/privacy" className="shrink-0 font-medium text-primary hover:underline">
            Đổi trong Cài đặt
          </Link>
        </div>
      )}

      {isLoading ? (
        <PostListSkeleton count={2} />
      ) : isError ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Không tải được mục này. Thử lại sau nhé.</div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Icon className="mx-auto mb-2.5 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">{isOwner ? empty.mine : empty.theirs(username)}</p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} variant="card" />
          ))}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!hasMore && !isLoadingMore && posts.length > 5 && (
              <span className="text-xs text-muted-foreground">Đã hiển thị tất cả</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
