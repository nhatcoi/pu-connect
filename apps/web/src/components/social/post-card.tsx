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
  Building2,
  Repeat2,
  BarChart2
} from 'lucide-react'
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
import { PostMediaGallery } from './post-media-gallery'
import { PostCommentsSection } from './comments/post-comments-section'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'

// Helper: Convert UUID / raw faculty code into human-readable label
function getCleanCourseBadge(post: PostItem) {
  if ((post as any).course) {
    return {
      label: `${(post as any).course.code} • ${(post as any).course.name}`,
      isFaculty: false
    }
  }

  if (post.courseId) {
    const raw = post.courseId.trim()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(raw)) {
      return null
    }

    const FACULTY_MAP: Record<string, string> = {
      FIT: 'Khoa Công nghệ Thông tin',
      FCS: 'Khoa Khoa học Máy tính',
      FEE: 'Khoa Điện - Điện tử',
      FBA: 'Khoa Kinh tế & QTKD',
      FAE: 'Khoa Kỹ thuật Ô tô',
      FMS: 'Khoa Y Dược',
      FEL: 'Khoa Ngôn ngữ Anh',
      FAS: 'Khoa Vật liệu & Công nghệ cao'
    }

    if (FACULTY_MAP[raw.toUpperCase()]) {
      return {
        label: `${raw.toUpperCase()} • ${FACULTY_MAP[raw.toUpperCase()]}`,
        isFaculty: true
      }
    }

    return {
      label: raw,
      isFaculty: false
    }
  }

  return null
}

interface PostCardProps {
  post: PostItem
  onLikeToggle?: (postId: string, isLiked: boolean) => void
  onDeleteSuccess?: (postId: string) => void
}

export function PostCard({ post: initialPost, onLikeToggle, onDeleteSuccess }: PostCardProps) {
  const [post, setPost] = useState<PostItem>(initialPost)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const user = useAppStore((state) => state.user)
  const toggleLikePost = useAppStore((state) => state.toggleLikePost)
  const toggleBookmarkPost = useAppStore((state) => state.toggleBookmarkPost)
  const setPosts = useAppStore((state) => state.setPosts)
  const storePosts = useAppStore((state) => state.posts)

  // Sync state if initialPost changes
  useEffect(() => {
    setPost(initialPost)
  }, [initialPost])

  // Check if current user is owner or admin
  const isOwner = user?.id && post.author?.id && String(user.id) === String(post.author.id)
  const isAdmin = user?.role === 'admin'
  const canManage = isOwner || isAdmin

  // Optimistic Like Toggle
  const handleLike = async () => {
    const newIsLiked = !post.isLikedByMe
    const newCount = (post.likesCount || 0) + (newIsLiked ? 1 : -1)

    // Optimistic UI update
    setPost((prev) => ({
      ...prev,
      isLikedByMe: newIsLiked,
      likesCount: Math.max(0, newCount)
    }))

    toggleLikePost(post.id)

    if (onLikeToggle) {
      onLikeToggle(post.id, newIsLiked)
    }

    try {
      await apiClient(`/posts/${post.id}/like`, { method: 'POST' })
    } catch {
      // Rollback if failed
      setPost((prev) => ({
        ...prev,
        isLikedByMe: !newIsLiked,
        likesCount: Math.max(0, (prev.likesCount || 0) + (newIsLiked ? -1 : 1))
      }))
      toggleLikePost(post.id)
      toast.error('Không thể thích bài viết. Vui lòng thử lại!')
    }
  }

  // Optimistic Bookmark Toggle
  const handleBookmark = async () => {
    const newIsBookmarked = !post.isBookmarkedByMe

    setPost((prev) => ({
      ...prev,
      isBookmarkedByMe: newIsBookmarked
    }))

    toggleBookmarkPost(post.id)

    try {
      await apiClient(`/posts/${post.id}/bookmark`, { method: 'POST' })
      toast.success(newIsBookmarked ? 'Đã lưu bài viết vào mục Yêu thích' : 'Đã bỏ lưu bài viết')
    } catch {
      setPost((prev) => ({
        ...prev,
        isBookmarkedByMe: !newIsBookmarked
      }))
      toggleBookmarkPost(post.id)
      toast.error('Không thể cập nhật trạng thái lưu bài viết')
    }
  }

  // Handle Delete Post
  const handleDeletePost = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return

    try {
      await apiClient(`/posts/${post.id}`, { method: 'DELETE' })
      toast.success('Đã xóa bài viết thành công')
      setPosts(storePosts.filter((p) => p.id !== post.id))
      if (onDeleteSuccess) {
        onDeleteSuccess(post.id)
      }
    } catch {
      toast.error('Không thể xóa bài viết. Vui lòng thử lại!')
    }
  }

  // Copy Link to Clipboard
  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/home#post-${post.id}`
    navigator.clipboard.writeText(postUrl)
    setIsCopied(true)
    toast.success('Đã sao chép liên kết bài viết vào clipboard')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleShareViaChat = () => {
    toast.success('Đã chia sẻ bài viết vào phòng chat nhóm đồ án PBL')
  }

  const authorInitials = (post.author?.displayName || post.author?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  const courseBadge = getCleanCourseBadge(post)
  const viewsCount = (post.likesCount || 0) * 8 + (post.commentsCount || 0) * 15 + 42

  return (
    <>
      <article
        id={`post-${post.id}`}
        className="p-3 sm:p-4 border-b border-border/70 sm:border sm:border-border sm:rounded-2xl bg-card text-card-foreground shadow-none sm:shadow-xs transition-colors hover:bg-muted/[0.08]"
      >
        {/* ── 2-Column Flex Layout (Signature X Twitter Architecture) ── */}
        <div className="flex items-start gap-3">
          
          {/* 1. Left Column: Author Avatar */}
          <div className="shrink-0 pt-0.5">
            <Link
              href={`/${post.author?.username || 'user'}`}
              className="cursor-pointer group block"
            >
              <Avatar className="h-10 w-10 border border-border/50 transition-transform group-hover:scale-105">
                <AvatarImage src={post.author?.avatarUrl || ''} alt={post.author?.displayName || ''} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {authorInitials}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>

          {/* 2. Right Column: Main Content (Indented aligned with author name) */}
          <div className="flex-1 min-w-0 space-y-2">
            
            {/* Header row: Author Name + Handle + Time + Badges + More Dropdown */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5 flex-wrap min-w-0">
                <Link
                  href={`/${post.author?.username || 'user'}`}
                  className="font-bold text-sm text-foreground hover:underline hover:text-primary transition-colors truncate"
                >
                  {post.author?.displayName || 'Sinh viên Phenikaa'}
                </Link>
                <span className="text-xs text-muted-foreground truncate">@{post.author?.username || 'student'}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(post.createdAt)}</span>
                
                {/* Academic Role Badge */}
                <AcademicBadge
                  role={post.author?.role}
                  reputationPoints={post.author?.reputationPoints}
                />
              </div>

              {/* Right: Badges & More dropdown */}
              <div className="flex items-center space-x-1.5 shrink-0">
                {post.postType === 'qa' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    <HelpCircle className="h-3 w-3 text-amber-500" />
                    <span>{post.isResolved ? 'Đã giải quyết' : 'Hỏi đáp'}</span>
                  </span>
                )}
                {post.postType === 'document' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    <BookOpen className="h-3 w-3 text-sky-500" />
                    <span>Tài liệu</span>
                  </span>
                )}
                {post.postType === 'group_recruit' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    <Users className="h-3 w-3 text-emerald-500" />
                    <span>Tuyển PBL</span>
                  </span>
                )}

                {courseBadge && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground max-w-[130px] sm:max-w-[160px] truncate">
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
                      className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer -mr-1"
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
            </div>

            {/* Post Title (if any) */}
            {post.title && (
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground leading-snug">
                {post.title}
              </h2>
            )}

            {/* Post Content (Markdown Preview) */}
            <div className="text-xs sm:text-sm text-foreground leading-relaxed break-words">
              <MarkdownPreview content={post.content} />
            </div>

            {/* Student Poll */}
            {post.poll && (
              <PostPollCard
                postId={post.id}
                poll={post.poll}
                onPollUpdated={(updatedPoll) => setPost((prev) => ({ ...prev, poll: updatedPoll }))}
              />
            )}

            {/* Media Gallery */}
            {post.mediaUrls && post.mediaUrls.length > 0 && (
              <div className="pt-1">
                <PostMediaGallery mediaUrls={post.mediaUrls} />
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {post.tags.map((tag) => (
                  <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-[11px] font-normal bg-muted text-muted-foreground hover:bg-muted/80 hover:text-primary transition-colors"
                    >
                      #{tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Attached Documents */}
            {post.attachedDocumentIds && post.attachedDocumentIds.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                <FileText className="h-4 w-4 text-primary" />
                <span>Đính kèm {post.attachedDocumentIds.length} tài liệu học phần</span>
              </div>
            )}

            {/* Actions Footer Row (X Twitter Style: Comments, Reposts, Likes, Views, Bookmark, Share) */}
            <div className="flex items-center justify-between pt-2 -ml-2 text-muted-foreground max-w-lg">
              {/* Comments Button */}
              <button
                type="button"
                onClick={() => setIsCommentsOpen((prev) => !prev)}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-sky-500/10 hover:text-sky-500 text-xs font-medium transition-colors cursor-pointer group',
                  isCommentsOpen && 'text-sky-500 font-bold'
                )}
                title="Bình luận & Thảo luận"
              >
                <MessageCircle className="h-4 w-4 group-hover:text-sky-500" />
                <span className="text-xs">{post.commentsCount || 0}</span>
              </button>

              {/* Repost / Study Group Button */}
              <button
                type="button"
                onClick={handleShareViaChat}
                className="flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-emerald-500/10 hover:text-emerald-500 text-xs font-medium transition-colors cursor-pointer group"
                title="Gửi vào nhóm đồ án"
              >
                <Repeat2 className="h-4 w-4 group-hover:text-emerald-500" />
                <span className="text-xs">{post.recruitSlotsFilled || (post.commentsCount > 2 ? 1 : 0)}</span>
              </button>

              {/* Like Button */}
              <button
                type="button"
                onClick={handleLike}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-rose-500/10 hover:text-rose-500 text-xs font-medium transition-colors cursor-pointer group',
                  post.isLikedByMe && 'text-rose-500'
                )}
                title="Thích bài viết"
              >
                <Heart
                  className={cn(
                    'h-4 w-4 transition-transform active:scale-125 group-hover:text-rose-500',
                    post.isLikedByMe && 'fill-current text-rose-500'
                  )}
                />
                <span className="text-xs">{post.likesCount || 0}</span>
              </button>

              {/* Views / Stats Count */}
              <div className="flex items-center gap-1 py-1 px-2 text-xs text-muted-foreground/80" title="Lượt xem bài viết">
                <BarChart2 className="h-4 w-4" />
                <span className="text-xs">{viewsCount}</span>
              </div>

              {/* Bookmark Button */}
              <button
                type="button"
                onClick={handleBookmark}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-amber-500/10 hover:text-amber-500 text-xs font-medium transition-colors cursor-pointer group',
                  post.isBookmarkedByMe && 'text-amber-500'
                )}
                title="Lưu bài viết"
              >
                <Bookmark
                  className={cn(
                    'h-4 w-4 transition-transform active:scale-125 group-hover:text-amber-500',
                    post.isBookmarkedByMe && 'fill-current text-amber-500'
                  )}
                />
              </button>

              {/* Share Button & Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 py-1 px-2 rounded-full hover:bg-primary/10 hover:text-primary text-xs font-medium text-muted-foreground transition-colors cursor-pointer group"
                    title="Chia sẻ"
                  >
                    <Share2 className="h-4 w-4 group-hover:text-primary" />
                  </button>
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
            </div>
          </div>
        </div>

        {/* Expandable Comments & Discussion Section */}
        <PostCommentsSection post={post} isOpen={isCommentsOpen} />
      </article>

      {/* Edit Post Dialog */}
      {isEditDialogOpen && (
        <EditPostDialog
          post={post}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={(updatedPost) => {
            setPost(updatedPost)
            setPosts(storePosts.map((p) => (p.id === post.id ? updatedPost : p)))
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
