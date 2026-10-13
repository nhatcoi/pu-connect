'use client'

import { FEATURES } from '@/lib/features'
import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { prefetchProfile } from '@/hooks/use-profile'
import { queryKeys } from '@/lib/query-keys'
import { graphqlClient } from '@/lib/graphql-client'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'
import { FollowButton } from '@/components/profile/follow-button'
import { ProfileCompletionCard } from '@/components/profile/profile-completion-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface SuggestedUser {
  id: string
  displayName: string
  username: string
  avatarUrl?: string | null
  role: string
  faculty?: string | null
  reputationPoints: number
  isFollowedByMe?: boolean
}

const GET_SUGGESTED_USERS_QUERY = `
  query GetSuggestedUsers($limit: Int) {
    suggestedUsers(limit: $limit) {
      id
      displayName
      username
      avatarUrl
      role
      faculty
      reputationPoints
      isFollowedByMe
    }
  }
`

export function RightSidebar() {
  const queryClient = useQueryClient()
  // Gợi ý theo dõi cache 10 phút (không tải lại mỗi lần chuyển trang)
  const { data: suggestedUsers = [], isPending: isLoadingUsers } = useQuery({
    queryKey: queryKeys.suggestedUsers(3),
    queryFn: async () => {
      const data = await graphqlClient<{ suggestedUsers: SuggestedUser[] }>(GET_SUGGESTED_USERS_QUERY, { limit: 3 })
      return Array.isArray(data?.suggestedUsers) ? data.suggestedUsers : []
    },
    staleTime: 10 * 60 * 1000
  })

  const trendingTopics = [
    { tag: '#DoAnTotNghiep2026', count: '142 bài viết', category: 'K15 Đồ án' },
    { tag: '#OnThiGiaiTich2', count: '89 bài viết', category: 'Toán học' },
    { tag: '#PhenikaaX_Robocon', count: '64 bài viết', category: 'Công nghệ' }
  ]

  const fallbackStudents: SuggestedUser[] = [
    { id: '1', displayName: 'TS. Nguyễn Văn Hà', role: 'lecturer', username: 'gv_ha', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false },
    { id: '2', displayName: 'Trần Minh Đức', role: 'student', username: 'duc_k16', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false },
    { id: '3', displayName: 'Lê Thị Mai', role: 'student', username: 'mai_pro', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false }
  ]

  const displayUsers = suggestedUsers.length > 0 ? suggestedUsers : fallbackStudents

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

      {/* 2. Gợi ý theo dõi: tối đa 3, nút outline (Who to follow) */}
      <section className="space-y-1">
        <h3 className="px-2 pb-1 text-[13px] font-semibold text-foreground">Gợi ý theo dõi</h3>
        {isLoadingUsers && suggestedUsers.length === 0 ? (
          <UserListSkeleton count={3} action label="Đang tải gợi ý theo dõi" />
        ) : (
          displayUsers.slice(0, 3).map((item) => (
            <div key={item.id || item.username} className="flex items-center justify-between gap-2 px-2 py-1.5">
              <Link href={`/${item.username}`} onMouseEnter={() => prefetchProfile(queryClient, item.username)} className="flex items-center gap-2.5 min-w-0 flex-1 group">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={item.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.username}`}
                    alt={item.displayName}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[11px]">
                    {item.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-[13px] font-medium text-foreground group-hover:underline truncate">
                      {item.displayName}
                    </span>
                    {item.role === 'lecturer' && <ShieldCheck className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">@{item.username}</span>
                </div>
              </Link>

              <FollowButton
                targetUserId={item.id}
                targetUsername={item.username}
                initialIsFollowing={item.isFollowedByMe || false}
                size="sm"
                variant="outline"
                showIcon={false}
                className="h-7 min-w-0 px-3 text-[11px] shrink-0 cursor-pointer"
              />
            </div>
          ))
        )}
      </section>

      {/* 3. Sleek Minimal Footer */}
      <div className="px-2 text-[11px] text-muted-foreground/70 space-y-1">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <Link href="/terms" prefetch={false} className="hover:underline">Điều khoản</Link>
          <span>·</span>
          <Link href="/privacy-policy" prefetch={false} className="hover:underline">Quyền riêng tư</Link>
          <span>·</span>
          <Link href="/search" prefetch={false} className="hover:underline">Trợ giúp</Link>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>PU Connector © 2026 Phenikaa</span>
        </div>
      </div>
    </div>
  )
}
