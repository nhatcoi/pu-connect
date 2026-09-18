'use client'

import React, { useState, useEffect } from 'react'
import { graphqlClient } from '@/lib/graphql-client'
import { FollowButton } from '@/components/profile/follow-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ShieldCheck,
  Loader2
} from 'lucide-react'
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
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  useEffect(() => {
    const fetchSuggested = async () => {
      setIsLoadingUsers(true)
      try {
        const data = await graphqlClient<{ suggestedUsers: SuggestedUser[] }>(
          GET_SUGGESTED_USERS_QUERY,
          { limit: 4 }
        )
        if (data && Array.isArray(data.suggestedUsers)) {
          setSuggestedUsers(data.suggestedUsers)
        }
      } catch {
        // Fallback static
      } finally {
        setIsLoadingUsers(false)
      }
    }

    fetchSuggested()
  }, [])

  const trendingTopics = [
    { tag: '#DoAnTotNghiep2026', count: '142 bài viết', category: 'K15 Đồ án' },
    { tag: '#OnThiGiaiTich2', count: '89 bài viết', category: 'Toán học' },
    { tag: '#PhenikaaX_Robocon', count: '64 bài viết', category: 'Công nghệ' },
    { tag: '#HocBongKhuyenKhich', count: '53 bài viết', category: 'Học bổng' }
  ]

  const fallbackStudents: SuggestedUser[] = [
    { id: '1', displayName: 'TS. Nguyễn Văn Hà', role: 'lecturer', username: 'gv_ha', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false },
    { id: '2', displayName: 'Trần Minh Đức', role: 'student', username: 'duc_k16', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false },
    { id: '3', displayName: 'Lê Thị Mai', role: 'student', username: 'mai_pro', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false }
  ]

  const displayUsers = suggestedUsers.length > 0 ? suggestedUsers : fallbackStudents

  return (
    <div className="w-full space-y-4">
      {/* 1. Xu Hướng Phenikaa (X Trending Style Widget) */}
      <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-3">
        <h3 className="text-sm font-black text-foreground tracking-tight">
          Xu hướng cho bạn
        </h3>
        <div className="space-y-3">
          {trendingTopics.map((topic) => (
            <div
              key={topic.tag}
              className="flex flex-col space-y-0.5 hover:bg-muted/40 p-1.5 -mx-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <span className="text-[11px] text-muted-foreground">{topic.category} · Đang thịnh hành</span>
              <span className="text-xs font-bold text-foreground hover:underline">{topic.tag}</span>
              <span className="text-[11px] text-muted-foreground">{topic.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Gợi Ý Kết Nối Bạn Bè & Giảng Viên (X Who to Follow Style Widget) */}
      <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-3.5">
        <h3 className="text-sm font-black text-foreground tracking-tight">
          Gợi ý theo dõi
        </h3>
        <div className="space-y-3">
          {isLoadingUsers && suggestedUsers.length === 0 ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            displayUsers.map((item) => (
              <div key={item.id || item.username} className="flex items-center justify-between gap-2">
                <Link
                  href={`/${item.username}`}
                  className="flex items-center gap-2.5 min-w-0 flex-1 group"
                >
                  <Avatar className="h-9 w-9 shrink-0 border border-border/40">
                    <AvatarImage
                      src={
                        item.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.username}`
                      }
                      alt={item.displayName}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {item.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-xs font-bold text-foreground group-hover:underline truncate">
                        {item.displayName}
                      </span>
                      {item.role === 'lecturer' && (
                        <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      @{item.username} {item.faculty ? `• ${item.faculty}` : ''}
                    </span>
                  </div>
                </Link>

                <FollowButton
                  targetUserId={item.id}
                  targetUsername={item.username}
                  initialIsFollowing={item.isFollowedByMe || false}
                  size="sm"
                  showIcon={false}
                  className="h-7 px-3 text-[11px] font-bold rounded-full bg-foreground text-background hover:bg-foreground/90 shrink-0 shadow-none cursor-pointer"
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Sleek Minimal Footer */}
      <div className="px-3 text-[11px] text-muted-foreground/70 space-y-1">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <Link href="/home" className="hover:underline">Điều khoản</Link>
          <span>·</span>
          <Link href="/home" className="hover:underline">Quyền riêng tư</Link>
          <span>·</span>
          <Link href="/search" className="hover:underline">Trợ giúp</Link>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>PU Connector © 2026 Phenikaa</span>
        </div>
      </div>
    </div>
  )
}
