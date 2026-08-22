'use client'

import React from 'react'
import Link from 'next/link'
import type { PostItem } from '@pu/schemas'
import { Heart, MessageCircle, Share2, FileText, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

interface PostCardProps {
  post: PostItem
  onLikeToggle?: (postId: string) => void
}

export function PostCard({ post, onLikeToggle }: PostCardProps) {
  const toggleLikePost = useAppStore((state) => state.toggleLikePost)

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onLikeToggle) {
      onLikeToggle(post.id)
    } else {
      toggleLikePost(post.id)
    }
  }

  const authorInitials = (post.author?.displayName || post.author?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Card className="overflow-hidden border border-border bg-card text-card-foreground shadow-xs transition-all duration-200 hover:border-border/80">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <Link
          href={`/${post.author.username}`}
          className="flex items-center space-x-3 group cursor-pointer"
        >
          <Avatar className="h-10 w-10 border border-border/50 transition-transform group-hover:scale-105">
            <AvatarImage src={post.author.avatarUrl || ''} alt={post.author.displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-foreground group-hover:underline group-hover:text-primary transition-colors">
                {post.author.displayName}
              </span>
              <span className="text-xs text-muted-foreground">@{post.author.username}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{post.createdAt}</span>
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {post.title && (
          <h2 className="text-base font-bold tracking-tight text-foreground leading-snug">
            {post.title}
          </h2>
        )}

        <MarkdownPreview content={post.content} />

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-pointer text-xs font-normal bg-muted text-muted-foreground hover:bg-muted/80">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {post.attachedDocumentIds && post.attachedDocumentIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span>Đính kèm {post.attachedDocumentIds.length} tài liệu học phần</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t border-border bg-muted/20 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn(
            'flex items-center space-x-1.5 text-xs font-medium transition-colors',
            post.isLikedByMe ? 'text-rose-500 hover:text-rose-600' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Heart className={cn('h-4 w-4 transition-transform active:scale-125', post.isLikedByMe && 'fill-current')} />
          <span>{post.likesCount}</span>
        </Button>

        <Button variant="ghost" size="sm" className="flex items-center space-x-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <MessageCircle className="h-4 w-4" />
          <span>{post.commentsCount}</span>
        </Button>

        <Button variant="ghost" size="sm" className="flex items-center space-x-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Share2 className="h-4 w-4" />
          <span>Chia sẻ</span>
        </Button>
      </CardFooter>
    </Card>
  )
}
