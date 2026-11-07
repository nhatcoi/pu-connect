'use client'

import React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { FileX2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PostCard } from '@/components/social/post-card'
import { usePostDetail } from '@/hooks/use-post-detail'
import { trackOnce } from '@/lib/track'
import { cn } from '@/lib/utils'

// Modal mở rộng bài viết (route chặn /post/[id] từ bảng tin).
// Bài có ảnh / tệp / khảo sát ⇒ 2 cột (trái: bài + tệp · phải: tương tác + bình luận); chỉ chữ ⇒ 1 cột.
export function PostExpandModal() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const highlightCommentId = useSearchParams().get('comment')
  const { post, status } = usePostDetail(id)

  React.useEffect(() => {
    if (status === 'ready') trackOnce({ type: 'post_open', targetType: 'post', targetId: id })
  }, [status, id])

  const wide = !!post && ((post.mediaUrls?.length ?? 0) > 0 || (post.documents?.length ?? 0) > 0 || (post.attachedDocumentIds?.length ?? 0) > 0 || !!post.poll)

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'p-0 gap-0 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200',
          wide ? 'h-[min(88vh,820px)] max-w-[min(1180px,calc(100vw-2rem))]' : 'max-h-[88vh] max-w-2xl overflow-y-auto'
        )}
      >
        <DialogTitle className="sr-only">{post?.title || 'Bài viết'}</DialogTitle>
        <DialogDescription className="sr-only">Chi tiết bài viết và bình luận</DialogDescription>
        {status === 'loading' ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : status === 'missing' || !post ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <FileX2 className="h-8 w-8 opacity-60" />
            <p className="text-sm">Bài viết không tồn tại hoặc đã bị xóa</p>
          </div>
        ) : (
          <PostCard
            key={post.id}
            post={post}
            variant="card"
            split={wide}
            defaultCommentsOpen
            highlightCommentId={highlightCommentId}
            onDeleteSuccess={() => router.back()}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
