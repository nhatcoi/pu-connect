'use client'

import { FEATURES } from '@/lib/features'
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
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
  BarChart2,
  UserPlus,
  UserMinus,
  Pin,
  PinOff,
  EyeOff,
  Sparkles
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
import { PostAnalyticsDialog } from './post-analytics-dialog'
import { PostMediaGallery } from './post-media-gallery'
import { PostCommentsSection } from './comments/post-comments-section'
import { PostSummary } from './post-summary'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { graphqlClient } from '@/lib/graphql-client'
import { cn, formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchProfile } from '@/hooks/use-profile'
import { prefetchCommunity } from '@/hooks/use-community'
import { patchPostEverywhere, removePostEverywhere, patchAuthorFollowed, invalidateFollowRelated } from '@/lib/post-cache'
import { useDwellTracking } from '@/hooks/use-dwell-tracking'

// Helper: Convert UUID / raw faculty code into human-readable label
function getCleanCourseBadge(post: PostItem): { label: string; isFaculty: boolean; href?: string } | null {
  // Bài gắn học phần ⇒ link sang trang học phần
  if (post.courseCode) {
    return { label: post.courseCode, isFaculty: false, href: `/courses/${encodeURIComponent(post.courseCode)}` }
  }
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
        label: raw.toUpperCase(),
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

const TOGGLE_FOLLOW_MUTATION = `
  mutation ToggleFollow($targetUserId: ID!) {
    toggleFollow(targetUserId: $targetUserId) {
      isFollowing
      followersCount
      followingCount
    }
  }
`

interface PostCardProps {
  post: PostItem
  onLikeToggle?: (postId: string, isLiked: boolean) => void
  onDeleteSuccess?: (postId: string) => void
  // 'card': thẻ bo góc trên nền surface (home) · 'flat': hàng phẳng có viền dưới
  variant?: 'flat' | 'card'
  // Trang chi tiết bài viết: mở sẵn bình luận và highlight bình luận từ thông báo
  defaultCommentsOpen?: boolean
  highlightCommentId?: string | null
}

// Thu gọn bài dài: hiện ~10 dòng; chỉ thu khi dư ≥ ~3 dòng (tránh "Xem thêm" chỉ để lộ 1 dòng)
// Collapse long posts to ~10 lines, only when the hidden part is worth a click
const COLLAPSED_MAX_HEIGHT = 240
const COLLAPSE_MIN_OVERFLOW = 64

export function PostCard({
  post: initialPost,
  onLikeToggle,
  onDeleteSuccess,
  variant = 'flat',
  defaultCommentsOpen = false,
  highlightCommentId
}: PostCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [post, setPost] = useState<PostItem>(initialPost)
  const [isCommentsOpen, setIsCommentsOpen] = useState(defaultCommentsOpen)
  // Đồng bộ bộ đếm bình luận với danh sách thực tế
  const queryClient = useQueryClient()
  const handleCommentsCount = useCallback(
    (count: number) => {
      setPost((prev) => (prev.commentsCount === count ? prev : { ...prev, commentsCount: count }))
      patchPostEverywhere(queryClient, initialPost.id, (p) => (p.commentsCount === count ? p : { ...p, commentsCount: count }))
    },
    [queryClient, initialPost.id]
  )
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [hiddenReason, setHiddenReason] = useState('')
  // Thu gọn bài dài + "Xem thêm" (Collapse long content)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(defaultCommentsOpen)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  // Bài hiện ≥ 2s trên bảng tin ⇒ tín hiệu quan tâm (trang chi tiết ghi post_open riêng)
  const articleRef = useRef<HTMLElement>(null)
  useDwellTracking(articleRef, defaultCommentsOpen ? null : { type: 'post_view', targetType: 'post', targetId: initialPost.id })

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const check = () => setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT + COLLAPSE_MIN_OVERFLOW)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [post.content])
  const [isFollowing, setIsFollowing] = useState(initialPost.isAuthorFollowedByMe || false)

  const user = useAppStore((state) => state.user)
  // Cập nhật bài này ở mọi danh sách đang cache (feed, cộng đồng, hồ sơ, search, chi tiết)
  const patchEverywhere = (updater: (p: PostItem) => PostItem) => patchPostEverywhere(queryClient, post.id, updater)

  // Sync state if initialPost changes
  useEffect(() => {
    setPost(initialPost)
    setIsFollowing(initialPost.isAuthorFollowedByMe || false)
  }, [initialPost])

  // Check if current user is owner or admin
  const isOwner = user?.id && post.author?.id && String(user.id) === String(post.author.id)
  const isAdmin = user?.role === 'admin'

  // Optimistic Like Toggle
  const handleLike = async () => {
    const newIsLiked = !post.isLikedByMe
    const newCount = (post.likesCount || 0) + (newIsLiked ? 1 : -1)

    setPost((prev) => ({
      ...prev,
      isLikedByMe: newIsLiked,
      likesCount: Math.max(0, newCount)
    }))

    patchEverywhere((p) => ({ ...p, isLikedByMe: newIsLiked, likesCount: Math.max(0, newCount) }))

    if (onLikeToggle) {
      onLikeToggle(post.id, newIsLiked)
    }

    try {
      await apiClient(`/posts/${post.id}/like`, { method: 'POST' })
    } catch {
      setPost((prev) => ({
        ...prev,
        isLikedByMe: !newIsLiked,
        likesCount: Math.max(0, (prev.likesCount || 0) + (newIsLiked ? -1 : 1))
      }))
      patchEverywhere((p) => ({
        ...p,
        isLikedByMe: !newIsLiked,
        likesCount: Math.max(0, (p.likesCount || 0) + (newIsLiked ? -1 : 1))
      }))
      toast.error('Không thể thích bài viết. Vui lòng thử lại!')
    }
  }

  // Optimistic Bookmark Toggle (Mục Đã lưu)
  const handleBookmark = async () => {
    const newIsBookmarked = !post.isBookmarkedByMe

    setPost((prev) => ({
      ...prev,
      isBookmarkedByMe: newIsBookmarked
    }))

    patchEverywhere((p) => ({ ...p, isBookmarkedByMe: newIsBookmarked }))

    try {
      await apiClient(`/posts/${post.id}/bookmark`, { method: 'POST' })
      // Tab "Đã lưu" tải lại khi mở
      queryClient.invalidateQueries({ queryKey: ['feed', 'bookmarks'] })
      toast.success(
        newIsBookmarked
          ? 'Đã lưu bài viết vào mục Đã lưu'
          : 'Đã bỏ lưu bài viết'
      )
    } catch {
      setPost((prev) => ({
        ...prev,
        isBookmarkedByMe: !newIsBookmarked
      }))
      patchEverywhere((p) => ({ ...p, isBookmarkedByMe: !newIsBookmarked }))
      toast.error('Không thể cập nhật bài viết đã lưu')
    }
  }

  // Handle Pin / Unpin Post
  const handleTogglePin = async () => {
    const newIsPinned = !post.isPinned

    setPost((prev) => ({
      ...prev,
      isPinned: newIsPinned
    }))
    patchEverywhere((p) => ({ ...p, isPinned: newIsPinned }))

    try {
      await apiClient(`/posts/${post.id}/pin`, { method: 'POST' })
    } catch {
      setPost((prev) => ({
        ...prev,
        isPinned: !newIsPinned
      }))
      patchEverywhere((p) => ({ ...p, isPinned: !newIsPinned }))
      toast.error('Không thể cập nhật trạng thái ghim bài viết')
    }
  }

  // Handle Toggle Follow Author
  const handleToggleFollowAuthor = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để theo dõi người dùng này')
      return
    }

    const previousState = isFollowing
    const nextState = !previousState

    setIsFollowing(nextState)
    patchAuthorFollowed(queryClient, post.author.id, nextState)

    try {
      const data = await graphqlClient<{
        toggleFollow: {
          isFollowing: boolean
          followersCount: number
          followingCount: number
        }
      }>(TOGGLE_FOLLOW_MUTATION, { targetUserId: post.author.id })

      if (data?.toggleFollow) {
        setIsFollowing(data.toggleFollow.isFollowing)
        patchAuthorFollowed(queryClient, post.author.id, data.toggleFollow.isFollowing)
        invalidateFollowRelated(queryClient, post.author.username)
      }
      toast.success(
        nextState
          ? `Đã theo dõi @${post.author?.username || 'user'}`
          : `Đã hủy theo dõi @${post.author?.username || 'user'}`
      )
    } catch {
      setIsFollowing(previousState)
      patchAuthorFollowed(queryClient, post.author.id, previousState)
      toast.error('Không thể cập nhật trạng thái theo dõi')
    }
  }

  // Handle "Not interested" (Không quan tâm bài viết này)
  const handleNotInterested = () => {
    setIsHidden(true)
    setHiddenReason('Đã ẩn bài viết khỏi bảng tin.')
    toast.success('Đã ẩn bài viết khỏi bảng tin')
  }

  // Handle Delete Post
  const handleDeletePost = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không? Toàn bộ thảo luận sẽ bị gỡ bỏ.')) return

    try {
      await apiClient(`/posts/${post.id}`, { method: 'DELETE' })
      toast.success('Đã xóa bài viết')
      removePostEverywhere(queryClient, post.id)
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
    toast.success('Đã sao chép liên kết bài viết')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleShareViaChat = () => {
    toast.success('Đã chia sẻ bài viết vào phòng chat')
  }

  const authorInitials = (post.author?.displayName || post.author?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  const courseBadge = getCleanCourseBadge(post)
  const viewsCount = (post.likesCount || 0) * 8 + (post.commentsCount || 0) * 15 + 42

  // If Post is Hidden by user (Dismiss Banner with Undo)
  if (isHidden) {
    return (
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-border/40 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground transition-all duration-200">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{hiddenReason || 'Đã ẩn bài viết khỏi bảng tin của bạn.'}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsHidden(false)}
          className="h-7 text-xs font-semibold text-primary hover:text-primary/80 hover:bg-primary/10 rounded-full cursor-pointer"
        >
          Hoàn tác
        </Button>
      </div>
    )
  }

  return (
    <>
      <article
        ref={articleRef}
        id={`post-${post.id}`}
        data-track-post={post.id}
        className={cn(
          'text-foreground transition-colors',
          variant === 'card'
            ? 'rounded-xl bg-card px-4 py-3.5 sm:px-5'
            : 'px-4 py-3.5 sm:px-5 sm:py-4 border-b border-border/40 bg-background hover:bg-muted/[0.03]'
        )}
      >
        {/* Pinned Top Banner (Only visible on author profile page) */}
        {post.isPinned && !!post.author?.username && (pathname === `/${post.author.username}` || pathname.startsWith(`/${post.author.username}?`)) && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary mb-1.5 ml-13">
            <Pin className="h-3 w-3 fill-current" />
            <span>Bài viết được ghim</span>
          </div>
        )}

        {/* ── 2-Column Flex Layout (Signature X Twitter Architecture) ── */}
        <div className="flex items-start gap-3">
          
          {/* 1. Left Column: Author Avatar */}
          <div className="shrink-0 pt-0.5">
            <Link
              href={`/${post.author?.username || 'user'}`}
              onMouseEnter={() => prefetchProfile(queryClient, post.author?.username || '')}
              className="cursor-pointer group block"
            >
              <Avatar className="h-9 w-9 transition-transform group-hover:scale-105">
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
                  onMouseEnter={() => prefetchProfile(queryClient, post.author?.username || '')}
                  className="font-semibold text-[13px] text-foreground hover:underline transition-colors truncate"
                >
                  {post.author?.displayName || 'Sinh viên Phenikaa'}
                </Link>
                <span className="text-xs text-muted-foreground truncate">@{post.author?.username || 'student'}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(post.createdAt)}</span>
                
                {/* Academic Role Badge */}
                <AcademicBadge
                  role={post.author?.role}
                />
              </div>

              {/* Right: Badges & More dropdown */}
              <div className="flex items-center space-x-1.5 shrink-0">
                {post.postType === 'qa' && (
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', post.isResolved ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary')}>
                    <HelpCircle className="h-3 w-3" />
                    <span>{post.isResolved ? 'Đã giải quyết' : 'Hỏi đáp'}</span>
                  </span>
                )}
                {post.postType === 'document' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <BookOpen className="h-3 w-3" />
                    <span>Tài liệu</span>
                  </span>
                )}
                {post.postType === 'group_recruit' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <Users className="h-3 w-3" />
                    <span>Học nhóm</span>
                  </span>
                )}

                {post.communitySlug && (
                  <Link
                    href={`/c/${post.communitySlug}`}
                    onMouseEnter={() => post.communitySlug && prefetchCommunity(queryClient, post.communitySlug)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-muted-foreground hover:text-primary hover:underline transition-colors shrink-0"
                  >
                    <span>c/{post.communitySlug}</span>
                  </Link>
                )}

                {courseBadge?.href && (
                  <Link
                    href={courseBadge.href}
                    onClick={(e) => e.stopPropagation()}
                    title={post.courseName || courseBadge.label}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary hover:underline max-w-[120px] truncate"
                  >
                    <GraduationCap className="h-3 w-3 shrink-0" />
                    <span className="truncate">{courseBadge.label}</span>
                  </Link>
                )}

                {courseBadge && !courseBadge.href && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground max-w-[120px] truncate">
                    {courseBadge.isFaculty ? (
                      <Building2 className="h-3 w-3 shrink-0" />
                    ) : (
                      <GraduationCap className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate">{courseBadge.label}</span>
                  </span>
                )}

                {/* ── Signature 3-Dots Dropdown Menu (Clean, Simple & Essential) ── */}
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
                  <DropdownMenuContent
                    align="end"
                    className="w-56 p-1.5 rounded-2xl shadow-xl border border-border/80 bg-popover/95 backdrop-blur-md"
                  >
                    {!isOwner ? (
                      <>
                        {/* 1. Follow / Unfollow User */}
                        <DropdownMenuItem
                          onClick={handleToggleFollowAuthor}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-muted cursor-pointer text-foreground"
                        >
                          {isFollowing ? (
                            <>
                              <UserMinus className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate">Bỏ theo dõi @{post.author?.username || 'user'}</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 text-primary shrink-0" />
                              <span className="truncate">Theo dõi @{post.author?.username || 'user'}</span>
                            </>
                          )}
                        </DropdownMenuItem>

                        {/* 2. Không quan tâm bài viết này */}
                        <DropdownMenuItem
                          onClick={handleNotInterested}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-muted cursor-pointer text-foreground"
                        >
                          <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>Không quan tâm bài này</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="my-1" />

                        {/* 3. Báo cáo vi phạm */}
                        <DropdownMenuItem
                          onClick={() => setIsReportDialogOpen(true)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-destructive/10 cursor-pointer text-destructive"
                        >
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          <span>Báo cáo bài viết</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        {/* 1. Ghim / Bỏ ghim bài viết lên trang cá nhân */}
                        <DropdownMenuItem
                          onClick={handleTogglePin}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-muted cursor-pointer text-foreground"
                        >
                          {post.isPinned ? (
                            <>
                              <PinOff className="h-4 w-4 text-amber-500 shrink-0" />
                              <span>Bỏ ghim khỏi trang cá nhân</span>
                            </>
                          ) : (
                            <>
                              <Pin className="h-4 w-4 text-primary shrink-0" />
                              <span>Ghim lên đầu trang cá nhân</span>
                            </>
                          )}
                        </DropdownMenuItem>

                        {/* 2. Chỉnh sửa bài viết */}
                        <DropdownMenuItem
                          onClick={() => setIsEditDialogOpen(true)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-muted cursor-pointer text-foreground"
                        >
                          <Pencil className="h-4 w-4 text-blue-500 shrink-0" />
                          <span>Chỉnh sửa bài viết</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="my-1" />

                        {/* 3. Xóa bài viết */}
                        <DropdownMenuItem
                          onClick={handleDeletePost}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl hover:bg-destructive/10 cursor-pointer text-destructive"
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                          <span>Xóa bài viết</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Post Title (if any) */}
            {post.title && (
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground leading-snug">
                {post.title}
              </h2>
            )}

            {/* Post Content (Markdown Preview) */}
            <div className="relative">
              <div
                ref={contentRef}
                className={cn(
                  'text-[13px] sm:text-sm text-foreground/90 leading-relaxed break-words',
                  isOverflowing && !isExpanded && 'overflow-hidden'
                )}
                style={isOverflowing && !isExpanded ? { maxHeight: COLLAPSED_MAX_HEIGHT } : undefined}
              >
                <MarkdownPreview content={post.content} />
              </div>
              {/* Fade mờ cuối đoạn khi thu gọn */}
              {isOverflowing && !isExpanded && (
                <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent', variant === 'card' ? 'from-card' : 'from-background')} />
              )}
            </div>
            {isOverflowing && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsExpanded((v) => !v)}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                </button>
                {/* Bài dài: tóm tắt bằng PU AI (cần đăng nhập) */}
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsSummaryOpen((v) => !v)}
                    aria-expanded={isSummaryOpen}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isSummaryOpen ? 'Ẩn tóm tắt' : 'Tóm tắt'}
                  </button>
                )}
              </div>
            )}
            {isSummaryOpen && <PostSummary postId={post.id} />}

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

            {/* Tags (X / Threads Style Inline Hashtags) */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?q=${encodeURIComponent(tag)}`}
                    className="text-xs font-medium text-primary hover:underline transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Attached Documents */}
            {post.attachedDocumentIds && post.attachedDocumentIds.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span>Đính kèm {post.attachedDocumentIds.length} tài liệu học phần</span>
              </div>
            )}

            {/* ── Actions Footer Row: Tym -> Bình luận -> Lưu -> Thống kê -> Share ── */}
            <div className="flex items-center justify-between pt-2 -ml-2 text-muted-foreground max-w-xl sm:max-w-2xl">
              
              {/* 1. Tym (Like) */}
              <button
                type="button"
                onClick={handleLike}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-rose-500/10 hover:text-rose-500 text-xs font-medium transition-colors cursor-pointer group',
                  post.isLikedByMe && 'text-rose-500'
                )}
                title={post.isLikedByMe ? 'Bỏ thích' : 'Thích bài viết'}
              >
                <Heart
                  className={cn(
                    'h-4 w-4 transition-transform active:scale-125 group-hover:text-rose-500',
                    post.isLikedByMe && 'fill-current text-rose-500'
                  )}
                />
                <span className="text-xs">{post.likesCount || 0}</span>
              </button>

              {/* 2. Bình luận (Comments) */}
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

              {/* 3. Lưu bài viết (Bookmark) */}
              <button
                type="button"
                onClick={handleBookmark}
                className={cn(
                  'flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-amber-500/10 hover:text-amber-500 text-xs font-medium transition-colors cursor-pointer group',
                  post.isBookmarkedByMe && 'text-amber-500'
                )}
                title={post.isBookmarkedByMe ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
              >
                <Bookmark
                  className={cn(
                    'h-4 w-4 transition-transform active:scale-125 group-hover:text-amber-500',
                    post.isBookmarkedByMe && 'fill-current text-amber-500'
                  )}
                />
              </button>

              {/* 4. Thống kê (ẩn: lượt xem tự tính, chưa tracking) */}
              {FEATURES.postAnalytics && (
              <button
                type="button"
                onClick={() => setIsAnalyticsOpen(true)}
                className="flex items-center gap-1 py-1 px-2 rounded-full hover:bg-sky-500/10 hover:text-sky-500 text-xs text-muted-foreground transition-colors cursor-pointer group"
                title="Xem phân tích & số liệu bài viết"
              >
                <BarChart2 className="h-4 w-4 group-hover:text-sky-500" />
                <span className="text-xs">{viewsCount}</span>
              </button>
              )}

              {/* 5. Chia sẻ (Share Menu: Copy Link, Gửi tin nhắn, Chia sẻ X) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 py-1 px-2 rounded-full hover:bg-primary/10 hover:text-primary text-xs font-medium text-muted-foreground transition-colors cursor-pointer group"
                    title="Chia sẻ bài viết"
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

                  {FEATURES.directMessage && (
                  <DropdownMenuItem
                    onClick={handleShareViaChat}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium"
                  >
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span>Gửi tin nhắn</span>
                  </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => {
                      const text = encodeURIComponent(`Xem bài viết: ${post.title || post.content.slice(0, 80)}`)
                      const url = encodeURIComponent(window.location.href)
                      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-muted font-medium"
                  >
                    <MessageSquareShare className="h-4 w-4 text-muted-foreground" />
                    <span>Chia sẻ lên X</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Expandable Comments & Discussion Section */}
        <PostCommentsSection
          post={post}
          isOpen={isCommentsOpen}
          highlightCommentId={highlightCommentId}
          onCountChange={handleCommentsCount}
        />
      </article>

      {/* Edit Post Dialog */}
      {isEditDialogOpen && (
        <EditPostDialog
          post={post}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={(updatedPost) => {
            setPost(updatedPost)
            patchPostEverywhere(queryClient, post.id, () => updatedPost)
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

      {/* Post Analytics Dialog */}
      {isAnalyticsOpen && (
        <PostAnalyticsDialog
          post={post}
          open={isAnalyticsOpen}
          onOpenChange={setIsAnalyticsOpen}
        />
      )}
    </>
  )
}
