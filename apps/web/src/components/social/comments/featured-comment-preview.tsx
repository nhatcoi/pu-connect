'use client'

import React from 'react'
import { Heart, MessageSquare, CheckCircle2 } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { N7AiMark } from '@/components/brand/pu-logo'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { N7AI_USERNAME } from '@/lib/mention'
import { cn, formatRelativeTime } from '@/lib/utils'
import { AnonymousAvatar } from '../anonymous-author'
import type { FeaturedComment } from '@pu/schemas'

interface FeaturedCommentPreviewProps {
  comment: FeaturedComment
  onOpen: () => void
}

// Bình luận nổi bật dưới bài trên bảng tin; bấm ⇒ mở khu bình luận
export function FeaturedCommentPreview({ comment, onOpen }: FeaturedCommentPreviewProps) {
  const name = comment.author.displayName || comment.author.username
  const isSolution = comment.reason === 'solution'
  const isBot = comment.author.username === N7AI_USERNAME

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer',
        isSolution ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'bg-muted/40 hover:bg-muted/70'
      )}
      title="Xem bình luận"
    >
      {comment.isAnonymous ? (
        <AnonymousAvatar className="h-6 w-6" />
      ) : isBot ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
          <N7AiMark className="h-[68%] w-[68%]" />
        </span>
      ) : (
        <Avatar className="h-6 w-6 shrink-0 border border-border">
          <AvatarImage src={comment.author.avatarUrl || ''} alt={name} />
          <AvatarFallback className="bg-muted text-foreground font-bold text-[9px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-xs text-foreground truncate">{name}</span>
          {isSolution ? (
            <span className="flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Lời giải
            </span>
          ) : comment.reason === 'top' ? (
            <span className="font-semibold text-primary">Nổi bật</span>
          ) : null}
          <span>•</span>
          <span className="shrink-0">{formatRelativeTime(comment.createdAt)}</span>
        </div>

        <MarkdownPreview content={comment.content} inline className="line-clamp-2 text-[13px] leading-snug text-foreground/90 break-words" />

        {(comment.likesCount > 0 || comment.repliesCount > 0) && (
          <div className="flex items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
            {comment.likesCount > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {comment.likesCount}
              </span>
            )}
            {comment.repliesCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {comment.repliesCount} trả lời
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
