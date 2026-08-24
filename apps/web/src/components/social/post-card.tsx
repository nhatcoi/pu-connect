'use client'

import React, { useState, useEffect } from 'react'
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
  Check,
  Pencil,
  Trash2,
  ShieldAlert,
  HelpCircle,
  BookOpen,
  Users,
  GraduationCap,
  Building2
} from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { AcademicBadge } from '@/components/ui/academic-badge'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { PostPollCard } from './post-poll-card'
import { EditPostDialog } from './edit-post-dialog'
import { ReportPostDialog } from './report-post-dialog'
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

export function PostCard({ post: initialPost, onLikeToggle }: PostCardProps) {
  const [post, setPost] = useState<PostItem>(initialPost)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [isLiking, setIsLiking] = useState(false)

  // Keep in sync with initialPost when parent updates
  useEffect(() => {
    setPost(initialPost)
  }, [initialPost])

  const currentUser = useAppStore((state) => state.user)
  const posts = useAppStore((state) => state.posts)
  const setPosts = useAppStore((state) => state.setPosts)
  const toggleLikePost = useAppStore((state) => state.toggleLikePost)
  const toggleBookmarkPost = useAppStore((state) => state.toggleBookmarkPost)

  const isAuthor =
    currentUser?.id &&
    (currentUser.id === post.authorId || currentUser.id === post.author?.id)
  const isAdmin = currentUser?.role === 'admin'
  const canManage = isAuthor || isAdmin

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isLiking) return

    const nextIsLiked = !post.isLikedByMe
    const nextCount = nextIsLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1)

    // 1. Optimistic UI updates
    setPost((prev) => ({ ...prev, isLikedByMe: nextIsLiked, likesCount: nextCount }))
    toggleLikePost(post.id)

    setIsLiking(true)
    try {
      if (onLikeToggle) {
        onLikeToggle(post.id)
      } else {
        const res = await apiClient<{ isLiked: boolean; likesCount: number }>(`/posts/${post.id}/like`, {
          method: 'POST'
        })
        if (res && typeof res.likesCount === 'number') {
          setPost((prev) => ({ ...prev, isLikedByMe: res.isLiked, likesCount: res.likesCount }))
        }
      }
    } catch {
      // Revert on error
      setPost((prev) => ({ ...prev, isLikedByMe: !nextIsLiked, likesCount: post.likesCount }))
      toggleLikePost(post.id)
      toast.error('Không thể thực hiện tương tác')
    } finally {
      setIsLiking(false)
    }
  }

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextState = !post.isBookmarkedByMe
    toggleBookmarkPost(post.id)
    setPost((prev) => ({ ...prev, isBookmarkedByMe: nextState }))
    try {
      await apiClient(`/posts/${post.id}/bookmark`, { method: 'POST' })
      toast.success(nextState ? 'Đã lưu bài viết vào mục yêu thích' : 'Đã bỏ lưu bài viết')
    } catch {
      toggleBookmarkPost(post.id)
      setPost((prev) => ({ ...prev, isBookmarkedByMe: !nextState }))
      toast.error('Không thể cập nhật trạng thái lưu bài viết')
    }
  }

  const handleDeletePost = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return
    try {
      await apiClient(`/posts/${post.id}`, { method: 'DELETE' })
      setPosts(posts.filter((p) => p.id !== post.id))
      toast.success('Đã xóa bài viết thành công')
    } catch {
      toast.error('Không thể xóa bài viết')
    }
  }

  const handleCopyLink = () => {
    const url =
      typeof window !== 'undefined'
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

  const courseBadge = getCleanCourseBadge(post)

  return (
    <>
      <Card
        id={`post-${post.id}`}
        className="overflow-hidden border border-border bg-card text-card-foreground shadow-xs transition-all duration-200 hover:border-border/80"
      >
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
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="font-semibold text-sm text-foreground group-hover:underline group-hover:text-primary transition-colors">
                  {post.author?.displayName || 'Sinh viên Phenikaa'}
                </span>
                <span className="text-xs text-muted-foreground">@{post.author?.username || 'student'}</span>
                
                {/* Academic Role Badge with Lucide SVG icons */}
                <AcademicBadge
                  role={post.author?.role}
                  reputationPoints={post.author?.reputationPoints}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">{formatRelativeTime(post.createdAt)}</span>
            </div>
          </Link>

          {/* Post Badges (SVG Lucide icons only - no text emoji) */}
          <div className="flex items-center space-x-1.5">
            {post.postType === 'qa' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
                <HelpCircle className="h-3 w-3 text-amber-500" />
                <span>Hỏi đáp</span>
                <span className="text-muted-foreground">{post.isResolved ? '• Đã giải quyết' : '• Cần giải đáp'}</span>
              </span>
            )}
            {post.postType === 'document' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
                <BookOpen className="h-3 w-3 text-sky-500" />
                <span>Tài liệu & Đề thi</span>
              </span>
            )}
            {post.postType === 'group_recruit' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
                <Users className="h-3 w-3 text-emerald-500" />
                <span>Tuyển nhóm PBL</span>
                {post.recruitSlotsTotal ? (
                  <span className="text-muted-foreground">({post.recruitSlotsFilled || 1}/{post.recruitSlotsTotal})</span>
                ) : null}
              </span>
            )}

            {courseBadge && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border px-2.5 py-0.5 text-[10px] font-semibold text-foreground max-w-[180px] truncate">
                {courseBadge.isFaculty ? (
                  <Building2 className="h-3 w-3 text-primary shrink-0" />
                ) : (
                  <GraduationCap className="h-3 w-3 text-primary shrink-0" />
                )}
                <span className="truncate">{courseBadge.label}</span>
              </span>
            )}

            {/* Dropdown Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1 rounded-xl shadow-lg border border-border bg-popover">
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  <span>Sao chép liên kết</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleShareViaChat}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium"
                >
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <span>Gửi vào nhóm đồ án</span>
                </DropdownMenuItem>

                {canManage ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setIsEditDialogOpen(true)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium text-foreground"
                    >
                      <Pencil className="h-4 w-4 text-blue-500" />
                      <span>Chỉnh sửa bài viết</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDeletePost}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-destructive/10 font-medium text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Xóa bài viết</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setIsReportDialogOpen(true)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-destructive/10 font-medium text-destructive"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      <span>Báo cáo vi phạm</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-3">
          {post.title && (
            <h2 className="text-base font-bold tracking-tight text-foreground leading-snug">
              {post.title}
            </h2>
          )}

          <MarkdownPreview content={post.content} />

          {/* Student Poll / Khảo sát sinh viên */}
          {post.poll && (
            <PostPollCard
              postId={post.id}
              poll={post.poll}
              onPollUpdated={(updatedPoll) => setPost((prev) => ({ ...prev, poll: updatedPoll }))}
            />
          )}

          {/* Cloudflare R2 Media Gallery */}
          {post.mediaUrls && post.mediaUrls.length > 0 && (
            <PostMediaGallery mediaUrls={post.mediaUrls} />
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {post.tags.map((tag) => (
                <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer text-xs font-normal bg-muted text-muted-foreground hover:bg-muted/80 hover:text-primary transition-colors"
                  >
                    #{tag}
                  </Badge>
                </Link>
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
            <Heart
              className={cn(
                'h-4 w-4 transition-transform active:scale-125',
                post.isLikedByMe && 'fill-current text-rose-500'
              )}
            />
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
            <Bookmark
              className={cn(
                'h-4 w-4 transition-transform active:scale-125',
                post.isBookmarkedByMe && 'fill-current text-amber-500'
              )}
            />
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

      {/* Edit Post Dialog */}
      {isEditDialogOpen && (
        <EditPostDialog
          post={post}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={(updated) => {
            setPost(updated)
            setPosts(posts.map((p) => (p.id === updated.id ? updated : p)))
          }}
        />
      )}

      {/* Report Post Dialog */}
      {isReportDialogOpen && (
        <ReportPostDialog
          postId={post.id}
          open={isReportDialogOpen}
          onOpenChange={setIsReportDialogOpen}
        />
      )}
    </>
  )
}

function getCleanCourseBadge(post: PostItem): { label: string; isFaculty: boolean } | null {
  if (post.courseCode) {
    return { label: post.courseCode, isFaculty: false }
  }
  if (post.courseName) {
    return { label: post.courseName, isFaculty: false }
  }
  if (post.facultyCode && post.facultyCode !== 'ALL') {
    return { label: post.facultyCode, isFaculty: true }
  }
  if (post.courseId && !post.courseId.includes('-') && post.courseId.length < 15) {
    return { label: post.courseId, isFaculty: false }
  }
  return null
}
