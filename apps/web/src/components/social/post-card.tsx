'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { PostItem } from '@pu/schemas'
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  FileText,
  MoreHorizontal,
  Copy,
  MessageSquareShare,
  Send,
  Check
} from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'

import { PostMediaGallery } from './post-media-gallery'
import { PostCommentsSection } from './comments/post-comments-section'

interface PostCardProps {
  post: PostItem
  onLikeToggle?: (postId: string) => void
}

export function PostCard({ post, onLikeToggle }: PostCardProps) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const toggleLikePost = useAppStore((state) => state.toggleLikePost)
  const toggleBookmarkPost = useAppStore((state) => state.toggleBookmarkPost)

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onLikeToggle) {
      onLikeToggle(post.id)
    } else {
      toggleLikePost(post.id)
    }
  }

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextState = !post.isBookmarkedByMe
    toggleBookmarkPost(post.id)
    try {
      await apiClient(`/posts/${post.id}/bookmark`, { method: 'POST' })
      toast.success(nextState ? 'Đã lưu bài viết vào mục yêu thích' : 'Đã bỏ lưu bài viết')
    } catch {
      toggleBookmarkPost(post.id) // Revert on failure
      toast.error('Không thể cập nhật trạng thái lưu bài viết')
    }
  }

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/#post-${post.id}`
      : `/posts/${post.id}`
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    toast.success('Đã sao chép liên kết bài viết vào bộ nhớ tạm')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleShareViaChat = () => {
    toast.success('Đã chia sẻ bài viết vào phòng chat nhóm đồ án PBL')
  }

  const authorInitials = (post.author?.displayName || post.author?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  // Clean course or faculty badge display
  const courseBadgeText = getCourseBadgeLabel(post)

  return (
    <Card id={`post-${post.id}`} className="overflow-hidden border border-border bg-card text-card-foreground shadow-xs transition-all duration-200 hover:border-border/80">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <Link
          href={`/${post.author?.username || 'user'}`}
          className="flex items-center space-x-3 group cursor-pointer"
        >
          <Avatar className="h-10 w-10 border border-border/50 transition-transform group-hover:scale-105">
            <AvatarImage src={post.author?.avatarUrl || ''} alt={post.author?.displayName || ''} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-foreground group-hover:underline group-hover:text-primary transition-colors">
                {post.author?.displayName || 'Sinh viên Phenikaa'}
              </span>
              <span className="text-xs text-muted-foreground">@{post.author?.username || 'student'}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{formatRelativeTime(post.createdAt)}</span>
          </div>
        </Link>

        {/* Post Badges */}
        <div className="flex items-center space-x-2">
          {post.postType === 'qa' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
              ❓ Hỏi đáp
              {post.isResolved ? ' • Đã giải quyết' : ' • Cần giải đáp'}
            </span>
          )}
          {post.postType === 'document' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
              📚 Tài liệu & Đề thi
            </span>
          )}
          {post.postType === 'group_recruit' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
              👥 Tuyển nhóm PBL
              {post.recruitSlotsTotal ? ` (${post.recruitSlotsFilled || 1}/${post.recruitSlotsTotal})` : ''}
            </span>
          )}

          {courseBadgeText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground max-w-[180px] truncate">
              {courseBadgeText}
            </span>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {post.title && (
          <h2 className="text-base font-bold tracking-tight text-foreground leading-snug">
            {post.title}
          </h2>
        )}

        <MarkdownPreview content={post.content} />

        {/* Cloudflare R2 Media Gallery */}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <PostMediaGallery mediaUrls={post.mediaUrls} />
        )}

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
        {/* Like Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn(
            'flex items-center space-x-1.5 text-xs font-medium transition-colors cursor-pointer',
            post.isLikedByMe ? 'text-rose-500 hover:text-rose-600' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Heart className={cn('h-4 w-4 transition-transform active:scale-125', post.isLikedByMe && 'fill-current')} />
          <span>{post.likesCount}</span>
        </Button>

        {/* Comments Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCommentsOpen((prev) => !prev)}
          className={cn(
            'flex items-center space-x-1.5 text-xs font-medium transition-colors cursor-pointer',
            isCommentsOpen ? 'text-foreground font-bold bg-muted/60' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.commentsCount}</span>
        </Button>

        {/* Bookmark Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBookmark}
          className={cn(
            'flex items-center space-x-1.5 text-xs font-medium transition-colors cursor-pointer',
            post.isBookmarkedByMe ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bookmark className={cn('h-4 w-4 transition-transform active:scale-125', post.isBookmarkedByMe && 'fill-current')} />
          <span>{post.isBookmarkedByMe ? 'Đã lưu' : 'Lưu'}</span>
        </Button>

        {/* Share Button & Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
              <span>Chia sẻ</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1 rounded-xl shadow-lg border border-border bg-popover">
            <DropdownMenuItem
              onClick={handleCopyLink}
              className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              <span>{isCopied ? 'Đã sao chép' : 'Sao chép liên kết'}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleShareViaChat}
              className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium"
            >
              <Send className="h-4 w-4 text-muted-foreground" />
              <span>Gửi qua tin nhắn</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                const text = encodeURIComponent(`Xem bài viết: ${post.title || post.content.slice(0, 80)}`)
                const url = encodeURIComponent(window.location.href)
                window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium"
            >
              <MessageSquareShare className="h-4 w-4 text-muted-foreground" />
              <span>Chia sẻ lên X (Twitter)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>

      {/* Expandable Comments & Discussion Section */}
      <PostCommentsSection post={post} isOpen={isCommentsOpen} />
    </Card>
  )
}

function getCourseBadgeLabel(post: PostItem): string | null {
  if (post.courseCode) {
    return `📘 ${post.courseCode}`
  }
  if (post.courseName) {
    return `📘 ${post.courseName}`
  }
  if (post.facultyCode && post.facultyCode !== 'ALL') {
    return `🏛️ ${post.facultyCode}`
  }
  // Check if courseId is NOT a UUID (e.g. human code)
  if (post.courseId && !post.courseId.includes('-') && post.courseId.length < 15) {
    return `📘 ${post.courseId}`
  }
  return null
}
