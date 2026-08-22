'use client'

import React from 'react'
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
}

export function PostCard({ post }: PostCardProps) {
  const toggleLikePost = useAppStore((state) => state.toggleLikePost)

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:border-border/80 hover:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatarUrl || ''} alt={post.author.displayName} />
            <AvatarFallback>{post.author.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm">{post.author.displayName}</span>
              <span className="text-xs text-muted-foreground">@{post.author.username}</span>
            </div>
            <span className="text-xs text-muted-foreground">{post.createdAt}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {post.title && <h2 className="text-base font-bold tracking-tight">{post.title}</h2>}

        <MarkdownPreview content={post.content} />

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-pointer text-xs font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {post.attachedDocumentIds && post.attachedDocumentIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span>Đính kèm {post.attachedDocumentIds.length} tài liệu liên quan</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t bg-muted/20 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleLikePost(post.id)}
          className={cn(
            'gap-1.5 text-xs font-normal hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30',
            post.isLikedByMe && 'text-red-500 font-medium'
          )}
        >
          <Heart className={cn('h-4 w-4', post.isLikedByMe && 'fill-current text-red-500')} />
          <span>{post.likesCount}</span>
        </Button>

        <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-normal">
          <MessageCircle className="h-4 w-4" />
          <span>{post.commentsCount} bình luận</span>
        </Button>

        <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-normal">
          <Share2 className="h-4 w-4" />
          <span>Chia sẻ</span>
        </Button>
      </CardFooter>
    </Card>
  )
}
