'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { patchPostEverywhere } from '@/lib/post-cache'
import { AnonymousAvatar, anonymousName } from './anonymous-author'
import { PostCommentsSection } from './comments/post-comments-section'
import { Heart, MessageCircle, Share2, Bookmark, ArrowUpRight } from 'lucide-react'
import type { PostItem } from '@pu/schemas'
import { useFeedPostActions } from '@/hooks/use-feed-post-actions'
import { useDwellTracking } from '@/hooks/use-dwell-tracking'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { markdownToPlainText } from '@/lib/plain-text'
import { cn, formatRelativeTime } from '@/lib/utils'
import { FocusFeedMedia } from './focus-feed-media'
import { PostCard } from './post-card'

export function FocusFeedCard({ post, active }: { post: PostItem; active: boolean }) {
  const [detail, setDetail] = useState<'read' | 'comments' | null>(null)
  const { toggle, share, pending } = useFeedPostActions(post)
  const ref = useRef<HTMLElement>(null)
  useDwellTracking(ref, active ? { type: 'post_view', targetType: 'post', targetId: post.id } : null)
  const qc = useQueryClient()
  const updateCount = useCallback(
    (count: number) => {
      patchPostEverywhere(qc, post.id, (p) => (p.commentsCount === count ? p : { ...p, commentsCount: count }))
    },
    [qc, post.id]
  )
  const hasMedia = post.mediaUrls.length > 0
  const actionClass =
    'flex min-h-12 w-12 flex-col items-center justify-center gap-1 rounded-full bg-background/90 py-2 text-foreground shadow-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50'
  return (
    <>
      <article
        ref={ref}
        data-track-post={post.id}
        className="relative mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-card text-card-foreground md:rounded-2xl"
      >
        <div className="relative min-h-0 flex-1">
          {hasMedia ? (
            <FocusFeedMedia urls={post.mediaUrls} active={active && !detail} />
          ) : (
            <div className="flex h-full items-center bg-primary/5 px-6 py-5 pr-20 sm:px-10 sm:pr-24">
              <div className="w-full min-w-0">
                <span className="text-xs font-medium text-primary">
                  {post.postType === 'qa' ? 'Hỏi đáp học tập' : post.poll ? 'Khảo sát' : 'Chia sẻ cùng cộng đồng'}
                </span>
                {post.title && <h2 className="mt-3 line-clamp-3 break-words text-xl font-bold sm:text-2xl">{post.title}</h2>}
                <p className="mt-4 line-clamp-6 whitespace-pre-line break-words text-base leading-relaxed sm:text-lg">{markdownToPlainText(post.content)}</p>
                <button className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary" onClick={() => setDetail('read')}>
                  Đọc đầy đủ <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="absolute right-2 bottom-4 flex flex-col gap-2 sm:right-4">
            <button disabled={pending} aria-label="Thích bài viết" aria-pressed={post.isLikedByMe} className={actionClass} onClick={() => void toggle('like')}>
              <Heart className={cn('h-6 w-6', post.isLikedByMe && 'fill-primary text-primary')} />
              <span className="text-xs">{post.likesCount}</span>
            </button>
            <button aria-label="Mở bình luận" className={actionClass} onClick={() => setDetail('comments')}>
              <MessageCircle className="h-6 w-6" />
              <span className="text-xs">{post.commentsCount}</span>
            </button>
            <button aria-label="Chia sẻ bài viết" className={actionClass} onClick={() => void share()}>
              <Share2 className="h-6 w-6" />
            </button>
            <button
              disabled={pending}
              aria-label="Lưu bài viết"
              aria-pressed={post.isBookmarkedByMe}
              className={actionClass}
              onClick={() => void toggle('bookmark')}
            >
              <Bookmark className={cn('h-6 w-6', post.isBookmarkedByMe && 'fill-primary text-primary')} />
            </button>
          </div>
        </div>
        <div className="shrink-0 space-y-2 border-t border-border bg-background px-4 py-3">
          <Link
            href={`/${post.author.username}`}
            className={cn('inline-flex max-w-full items-center gap-2', post.isAnonymous && 'pointer-events-none')}
            tabIndex={post.isAnonymous ? -1 : undefined}
          >
            {post.isAnonymous ? (
              <AnonymousAvatar className="h-9 w-9" />
            ) : (
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={post.author.avatarUrl ?? ''} />
                <AvatarFallback>{post.author.displayName.slice(0, 2)}</AvatarFallback>
              </Avatar>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{post.isAnonymous ? anonymousName(post.isMine) : post.author.displayName}</span>
              <span className="block text-xs text-muted-foreground">{formatRelativeTime(post.createdAt)}</span>
            </span>
          </Link>
          {hasMedia && (
            <button className="block w-full text-left text-sm" onClick={() => setDetail('read')}>
              <span className="line-clamp-2 break-words">{post.title || markdownToPlainText(post.content)}</span>
              <span className="font-medium text-primary">Xem thêm</span>
            </button>
          )}
          {!hasMedia && (post.poll || post.attachedDocumentIds.length > 0) && (
            <button className="min-h-9 text-sm font-medium text-primary" onClick={() => setDetail('read')}>
              {post.poll ? 'Mở khảo sát và bình chọn' : 'Mở tài liệu đính kèm'}
            </button>
          )}
        </div>
      </article>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent
          className="top-auto bottom-0 max-h-[85dvh] translate-y-0 rounded-t-2xl p-0 pt-10 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:max-w-2xl"
          aria-describedby={undefined}
        >
          <DialogTitle className={detail === 'comments' ? 'px-4 text-base' : 'sr-only'}>
            {detail === 'comments' ? 'Bình luận bài viết' : 'Nội dung bài viết'}
          </DialogTitle>
          {detail === 'comments' ? (
            <div className="px-4 pb-4">
              <PostCommentsSection post={post} isOpen onCountChange={updateCount} />
            </div>
          ) : detail === 'read' ? (
            <PostCard post={post} defaultExpanded />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
