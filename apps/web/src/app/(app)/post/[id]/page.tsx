'use client'

import React, { Suspense, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FileX2 } from 'lucide-react'
import { FeedSkeleton } from '@/components/skeletons/feed-skeleton'
import { PostCard } from '@/components/social/post-card'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { findCachedPost } from '@/lib/post-cache'
import { trackOnce } from '@/lib/track'
import type { PostItem } from '@pu/schemas'

// Trang chi tiết bài viết: /post/{id}?comment={commentId} (đích điều hướng của thông báo)
function PostDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const highlightCommentId = useSearchParams().get('comment')
  const queryClient = useQueryClient()

  // Cache ['post', id]; nếu bài đã có trong feed/cộng đồng thì hiện ngay (initialData) rồi làm mới ngầm
  const { data: post, isPending, isError } = useQuery({
    queryKey: queryKeys.post(id),
    queryFn: async () => (await apiClient<{ success: boolean; data: PostItem }>(`/posts/${id}`)).data,
    initialData: () => findCachedPost(queryClient, id),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 1000,
    enabled: !!id
  })
  const status = isPending ? 'loading' : isError || !post ? 'missing' : 'ready'
  // Mở chi tiết bài ⇒ tín hiệu quan tâm mạnh hơn lướt qua bảng tin
  useEffect(() => {
    if (status === 'ready') trackOnce({ type: 'post_open', targetType: 'post', targetId: id })
  }, [status, id])

  return (
    <div className="pt-3">
      <div className="mx-2 sm:mx-0 mb-2 flex items-center gap-2">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
          aria-label="Quay lại"
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-bold">Bài viết</h1>
      </div>

      <div className="px-2 sm:px-0">
        {status === 'loading' ? (
          <FeedSkeleton count={1} />
        ) : status === 'missing' || !post ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card py-14 text-center text-muted-foreground">
            <FileX2 className="h-8 w-8 opacity-60" />
            <p className="text-sm">Bài viết không tồn tại hoặc đã bị xóa</p>
            <Link href="/" className="text-xs font-semibold text-primary hover:underline">
              Về bảng tin
            </Link>
          </div>
        ) : (
          <PostCard
            key={post.id}
            post={post}
            variant="card"
            defaultCommentsOpen
            highlightCommentId={highlightCommentId}
            onDeleteSuccess={() => router.push('/')}
          />
        )}
      </div>
    </div>
  )
}

export default function PostDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <PostDetail />
    </Suspense>
  )
}
