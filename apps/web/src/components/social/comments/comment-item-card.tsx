'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { N7AiMark } from '@/components/brand/pu-logo'
import { PostMediaGallery } from '../post-media-gallery'
import { ReportPostDialog } from '../report-post-dialog'
import { CommentComposer } from './comment-composer'
import { Heart, MessageSquare, CheckCircle2, Trash2, Check, Pencil, Flag } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { CommentItem, MentionCandidate } from '@pu/schemas'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchProfile } from '@/hooks/use-profile'
import { N7AI_USERNAME } from '@/lib/mention'
import { AnonymousAvatar, anonymousName } from '../anonymous-author'

interface CommentItemCardProps {
  comment: CommentItem
  isPostAuthor?: boolean
  isQaPost?: boolean
  currentUserId?: string
  onLikeToggle: (commentId: string) => void
  onAcceptSolution?: (commentId: string) => void
  onDeleteComment?: (commentId: string) => void
  onReplySubmit: (content: string, parentId: string, mediaUrls?: string[], anonymous?: boolean) => Promise<unknown>
  onEditComment?: (commentId: string, content: string) => Promise<boolean>
  mentionContext?: MentionCandidate[]
  // Bình luận được mở từ thông báo (cuộn tới + viền nổi bật)
  isHighlighted?: boolean
}

export function CommentItemCard({
  comment,
  isHighlighted,
  isPostAuthor,
  isQaPost,
  currentUserId,
  onLikeToggle,
  onAcceptSolution,
  onDeleteComment,
  onReplySubmit,
  onEditComment,
  mentionContext
}: CommentItemCardProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isReporting, setIsReporting] = useState(false)
  const queryClient = useQueryClient()

  const authorInitials = (comment.author?.displayName || comment.author?.username || 'PU').slice(0, 2).toUpperCase()

  const isMyComment = comment.isMine || currentUserId === comment.authorId

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        'group relative rounded-xl transition-all duration-150 p-3 space-y-2 scroll-mt-28',
        isHighlighted && 'ring-2 ring-brand-orange/60 bg-brand-orange/5',
        comment.isSolution ? 'bg-emerald-500/5 border border-emerald-500/30' : 'hover:bg-muted/30 border border-transparent hover:border-border/50'
      )}
    >
      {/* Solution Banner */}
      {comment.isSolution && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 pb-1">
          <CheckCircle2 className="h-4 w-4" />
          <span>Lời giải được tác giả công nhận chính xác</span>
        </div>
      )}

      {/* Header: Author info */}
      <div className="flex items-start justify-between">
        <Link
          href={`/${comment.author?.username || 'user'}`}
          onMouseEnter={() => !comment.isAnonymous && prefetchProfile(queryClient, comment.author?.username || '')}
          className={cn('flex items-center space-x-2.5 group/author cursor-pointer', comment.isAnonymous && 'pointer-events-none')}
          tabIndex={comment.isAnonymous ? -1 : undefined}
        >
          {comment.isAnonymous ? (
            <AnonymousAvatar className="h-7 w-7" />
          ) : comment.author?.username === N7AI_USERNAME ? (
            // N7AI trả lời khi được @n7ai
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted">
              <N7AiMark className="h-[68%] w-[68%]" />
            </span>
          ) : (
            <Avatar className="h-7 w-7 border border-border select-none shadow-xs">
              <AvatarImage src={comment.author?.avatarUrl || ''} alt={comment.author?.displayName || ''} />
              <AvatarFallback className="bg-muted text-foreground font-bold text-[10px]">{authorInitials}</AvatarFallback>
            </Avatar>
          )}

          <div className="flex items-center gap-2">
            {comment.isAnonymous ? (
              <span className="font-bold text-xs text-foreground">{anonymousName(comment.isMine)}</span>
            ) : (
              <>
                <span className="font-bold text-xs text-foreground group-hover/author:underline">{comment.author?.displayName || 'Sinh viên Phenikaa'}</span>
                <span className="text-[11px] text-muted-foreground">@{comment.author?.username || 'student'}</span>
              </>
            )}
            <span className="text-muted-foreground text-[10px]">•</span>
            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
            {comment.editedAt && (
              <span className="text-[10px] text-muted-foreground" title={`Sửa lúc ${new Date(comment.editedAt).toLocaleString('vi-VN')}`}>
                · đã chỉnh sửa
              </span>
            )}
          </div>
        </Link>

        {/* Top-right Actions: Solution Toggle or Delete */}
        <div className="flex items-center gap-1">
          {isPostAuthor && isQaPost && onAcceptSolution && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAcceptSolution(comment.id)}
              className={cn(
                'h-6 px-2 text-[10px] font-bold rounded-full gap-1 cursor-pointer transition-colors',
                comment.isSolution
                  ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                  : 'hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30'
              )}
            >
              <Check className="h-3 w-3" />
              <span>{comment.isSolution ? 'Đã duyệt' : 'Duyệt lời giải'}</span>
            </Button>
          )}

          {/* Màn cảm ứng không có hover ⇒ luôn hiện; desktop hiện khi rê chuột / focus */}
          {isMyComment && onEditComment && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer rounded-full"
              title="Sửa bình luận"
              aria-label="Sửa bình luận"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          {!isMyComment && currentUserId && (
            <button
              type="button"
              onClick={() => setIsReporting(true)}
              className="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer rounded-full"
              title="Báo cáo bình luận"
              aria-label="Báo cáo bình luận"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          )}

          {isMyComment && onDeleteComment && (
            <button
              type="button"
              onClick={() => onDeleteComment(comment.id)}
              className="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer rounded-full"
              title="Xóa bình luận"
              aria-label="Xóa bình luận"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Comment Body */}
      <div className="pl-9 space-y-2">
        {isEditing && onEditComment ? (
          <CommentComposer
            mode="edit"
            autoFocus
            initialContent={comment.content}
            postId={comment.postId}
            mentionContext={mentionContext}
            onSubmit={async (text) => {
              const ok = await onEditComment(comment.id, text)
              if (ok) setIsEditing(false)
              return ok
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <MarkdownPreview content={comment.content} className="text-xs leading-relaxed" />
        )}

        {comment.mediaUrls && comment.mediaUrls.length > 0 && <PostMediaGallery mediaUrls={comment.mediaUrls} className="mt-1" />}

        {/* Actions bar: Like, Reply */}
        <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => onLikeToggle(comment.id)}
            className={cn('flex items-center gap-1 transition-colors cursor-pointer hover:text-rose-500', comment.isLikedByMe && 'text-rose-500 font-semibold')}
          >
            <Heart className={cn('h-3.5 w-3.5 transition-transform active:scale-125', comment.isLikedByMe && 'fill-current text-rose-500')} />
            <span>{comment.likesCount || 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReplyComposer((prev) => !prev)}
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Trả lời</span>
          </button>
        </div>

        {/* Nested Reply Composer with Auto-tag */}
        {showReplyComposer && (
          <div className="pt-2">
            <CommentComposer
              parentId={comment.id}
              autoFocus
              initialContent={comment.isAnonymous ? '' : `@${comment.author?.username || 'user'} `}
              postId={comment.postId}
              mentionContext={mentionContext}
              draftKey={`reply:${comment.id}`}
              onSubmit={async (text, media, anonymous) => {
                const created = await onReplySubmit(text, comment.id, media, anonymous)
                if (created) setShowReplyComposer(false)
                return created
              }}
              onCancel={() => setShowReplyComposer(false)}
            />
          </div>
        )}
      </div>

      {isReporting && <ReportPostDialog postId={comment.postId} commentId={comment.id} open={isReporting} onOpenChange={setIsReporting} />}
    </div>
  )
}
