'use client'

import React from 'react'
import type { PostItem } from '@pu/schemas'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BarChart2, Eye, Heart, MessageCircle, Bookmark, Repeat2, Award, TrendingUp, GraduationCap, Sparkles } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { markdownToPlainText } from '@/lib/plain-text'

interface PostAnalyticsDialogProps {
  post: PostItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PostAnalyticsDialog({ post, open, onOpenChange }: PostAnalyticsDialogProps) {
  // Approximate impressions/views
  const viewsCount = (post.likesCount || 0) * 8 + (post.commentsCount || 0) * 15 + 42
  const totalEngagements = (post.likesCount || 0) + (post.commentsCount || 0) + (post.sharesCount || 0) + (post.isBookmarkedByMe ? 1 : 0)

  const engagementRate = viewsCount > 0 ? ((totalEngagements / viewsCount) * 100).toFixed(1) : '0.0'

  const authorInitials = (post.author?.displayName || post.author?.username || 'PU').slice(0, 2).toUpperCase()

  // Calculate percentages for progress bars
  const totalActionPoints = Math.max(1, totalEngagements)
  const likesPercent = Math.round(((post.likesCount || 0) / totalActionPoints) * 100)
  const commentsPercent = Math.round(((post.commentsCount || 0) / totalActionPoints) * 100)
  const sharesPercent = Math.round(((post.sharesCount || 0) / totalActionPoints) * 100)
  const bookmarksPercent = Math.max(0, 100 - likesPercent - commentsPercent - sharesPercent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border/80 bg-card rounded-2xl shadow-2xl">
        {/* Header with gradient badge */}
        <div className="p-5 pr-12 border-b border-border/60 bg-muted/20">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <BarChart2 className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-foreground">Số liệu & Phân tích bài viết</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Thống kê tương tác thời gian thực và độ lan tỏa học thuật trong mạng lưới Phenikaa.
            </DialogDescription>
          </DialogHeader>

          {/* Post Snippet Card */}
          <div className="mt-3 flex items-center gap-3 p-2.5 rounded-xl bg-background/80 border border-border/60 text-xs">
            <Avatar className="h-8 w-8 shrink-0 border border-border/50">
              <AvatarImage src={post.author?.avatarUrl || ''} alt={post.author?.displayName || ''} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">{authorInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                <span className="truncate">{post.author?.displayName || 'Sinh viên'}</span>
                <span className="text-muted-foreground font-normal text-[11px]">
                  @{post.author?.username || 'user'} · {formatRelativeTime(post.createdAt)}
                </span>
              </div>
              <p className="text-muted-foreground truncate text-[11px]">{post.title || markdownToPlainText(post.content).slice(0, 70)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(85vh-150px)]">
          {/* Key Metrics 4-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Impressions */}
            <div className="p-3 rounded-xl border border-border/70 bg-background flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground gap-1">
                <span className="text-[11px] font-medium truncate">Lượt hiển thị</span>
                <Eye className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-extrabold text-foreground">{viewsCount}</div>
                <div className="flex items-center gap-0.5 text-[10px] text-emerald-500 font-semibold mt-0.5 truncate">
                  <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                  <span>+18% xu hướng</span>
                </div>
              </div>
            </div>

            {/* Total Engagements */}
            <div className="p-3 rounded-xl border border-border/70 bg-background flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground gap-1">
                <span className="text-[11px] font-medium truncate">Tương tác</span>
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-extrabold text-foreground">{totalEngagements}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Hành động cụ thể</div>
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="p-3 rounded-xl border border-border/70 bg-background flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground gap-1">
                <span className="text-[11px] font-medium truncate">Tỷ lệ tương tác</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-extrabold text-foreground">{engagementRate}%</div>
                <div className="text-[10px] text-emerald-500 font-semibold mt-0.5 truncate">Rất tích cực</div>
              </div>
            </div>

            {/* Reputation Points Earned */}
            <div className="p-3 rounded-xl border border-border/70 bg-background flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground gap-1">
                <span className="text-[11px] font-medium truncate">Điểm uy tín</span>
                <Award className="h-3.5 w-3.5 text-primary shrink-0" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-extrabold text-primary">+5 Rep</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Phenikaa Academic</div>
              </div>
            </div>
          </div>

          {/* Detailed Actions Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Chi tiết phân bổ tương tác</h4>

            {/* Multi-segment Progress Bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
              {likesPercent > 0 && (
                <div style={{ width: `${likesPercent}%` }} className="bg-rose-500 transition-all duration-500" title={`Lượt thích: ${likesPercent}%`} />
              )}
              {commentsPercent > 0 && (
                <div style={{ width: `${commentsPercent}%` }} className="bg-sky-500 transition-all duration-500" title={`Thảo luận: ${commentsPercent}%`} />
              )}
              {sharesPercent > 0 && (
                <div style={{ width: `${sharesPercent}%` }} className="bg-emerald-500 transition-all duration-500" title={`Gửi vào nhóm: ${sharesPercent}%`} />
              )}
              {bookmarksPercent > 0 && (
                <div style={{ width: `${bookmarksPercent}%` }} className="bg-amber-500 transition-all duration-500" title={`Lưu trữ: ${bookmarksPercent}%`} />
              )}
            </div>

            {/* 4 Detail Rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-background/60">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                  <Heart className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span className="text-muted-foreground">Lượt thích</span>
                </div>
                <span className="font-bold text-foreground">{post.likesCount || 0}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-background/60">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                  <MessageCircle className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <span className="text-muted-foreground">Bình luận & Lời giải</span>
                </div>
                <span className="font-bold text-foreground">{post.commentsCount || 0}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-background/60">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <Repeat2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="text-muted-foreground">Chia sẻ vào nhóm</span>
                </div>
                <span className="font-bold text-foreground">{post.sharesCount || 0}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-background/60">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <Bookmark className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-muted-foreground">Lưu vào bộ sưu tập</span>
                </div>
                <span className="font-bold text-foreground">{post.isBookmarkedByMe ? 1 : 0}</span>
              </div>
            </div>
          </div>

          {/* Academic Graph Reach */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span>Độ phủ học thuật (Academic Reach)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bài viết đã được thuật toán phân phối ưu tiên tới sinh viên cùng lĩnh vực{' '}
              <strong className="text-foreground">{post.author?.interestField || 'quan tâm'}</strong>
              {post.courseName ? ` và học phần ${post.courseName}` : ''}.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-end">
          <Button type="button" variant="default" onClick={() => onOpenChange(false)} className="rounded-full font-bold text-xs px-6 cursor-pointer">
            Đã hiểu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
