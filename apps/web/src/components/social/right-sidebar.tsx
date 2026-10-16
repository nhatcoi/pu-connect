'use client'

import { FEATURES } from '@/lib/features'
import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { prefetchProfile } from '@/hooks/use-profile'
import { suggestionReasonText, useSidebarSuggestions } from '@/hooks/use-follow-suggestions'
import { useAppStore } from '@/store'
import { FollowSuggestionsDialog } from './follow-suggestions-dialog'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'
import { FollowButton } from '@/components/profile/follow-button'
import { ProfileCompletionCard } from '@/components/profile/profile-completion-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export function RightSidebar() {
  const queryClient = useQueryClient()
  const user = useAppStore((s) => s.user)
  const [exploreOpen, setExploreOpen] = useState(false)
  // Gợi ý theo dõi cache 10 phút; cùng thuật toán xếp hạng với modal Khám phá
  const { data: suggestedUsers = [], isPending: isLoadingUsers } = useSidebarSuggestions(!!user)

  const trendingTopics = [
    { tag: '#DoAnTotNghiep2026', count: '142 bài viết', category: 'K15 Đồ án' },
    { tag: '#OnThiGiaiTich2', count: '89 bài viết', category: 'Toán học' },
    { tag: '#PhenikaaX_Robocon', count: '64 bài viết', category: 'Công nghệ' }
  ]

  return (
    <div className="w-full space-y-6">
      <ProfileCompletionCard />

      {/* 1. Xu hướng — ẩn: số liệu cứng, chưa có API */}
      {FEATURES.trending && (
        <section className="space-y-1">
          <h3 className="px-2 pb-1 text-[13px] font-semibold text-foreground">Xu hướng</h3>
          {trendingTopics.map((topic) => (
            <Link
              key={topic.tag}
              href={`/search?q=${encodeURIComponent(topic.tag)}`}
              className="flex flex-col rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors"
            >
              <span className="text-[13px] font-medium text-foreground">{topic.tag}</span>
              <span className="text-[11px] text-muted-foreground">
                {topic.category} · {topic.count}
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* 2. Gợi ý theo dõi: tối đa 3, nút outline (Who to follow); trống ⇒ ẩn cả mục */}
      {user && (isLoadingUsers || suggestedUsers.length > 0) && (
        <section className="space-y-1">
          <h3 className="px-2 pb-1 text-[13px] font-semibold text-foreground">Gợi ý theo dõi</h3>
          {isLoadingUsers && suggestedUsers.length === 0 ? (
            <UserListSkeleton count={3} action label="Đang tải gợi ý theo dõi" />
          ) : (
            suggestedUsers.slice(0, 3).map((item) => (
              <div key={item.id || item.username} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <Link
                  href={`/${item.username}`}
                  onMouseEnter={() => prefetchProfile(queryClient, item.username)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 group"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={item.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.username}`} alt={item.displayName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[11px]">
                      {item.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-[13px] font-medium text-foreground group-hover:underline truncate">{item.displayName}</span>
                      {item.role === 'lecturer' && <ShieldCheck className="h-3 w-3 text-primary shrink-0" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">{suggestionReasonText(item)}</span>
                  </div>
                </Link>

                <FollowButton
                  targetUserId={item.id}
                  targetUsername={item.username}
                  initialIsFollowing={false}
                  size="sm"
                  variant="outline"
                  showIcon={false}
                  className="h-7 min-w-0 px-3 text-[11px] shrink-0 cursor-pointer"
                />
              </div>
            ))
          )}
          {suggestedUsers.length > 0 && (
            <button
              type="button"
              onClick={() => setExploreOpen(true)}
              className="px-2 pt-1 text-[12px] font-medium text-primary hover:underline cursor-pointer"
            >
              Xem thêm
            </button>
          )}
        </section>
      )}

      <FollowSuggestionsDialog open={exploreOpen} onOpenChange={setExploreOpen} />

      {/* 3. Sleek Minimal Footer */}
      <div className="px-2 text-[11px] text-muted-foreground/70 space-y-1">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <Link href="/terms" prefetch={false} className="hover:underline">
            Điều khoản
          </Link>
          <span>·</span>
          <Link href="/privacy-policy" prefetch={false} className="hover:underline">
            Quyền riêng tư
          </Link>
          <span>·</span>
          <Link href="/search" prefetch={false} className="hover:underline">
            Trợ giúp
          </Link>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>PU Connector © 2026 Phenikaa</span>
        </div>
      </div>
    </div>
  )
}
