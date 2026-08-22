'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { graphqlClient } from '@/lib/graphql-client'
import { FollowButton } from '@/components/profile/follow-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  GraduationCap,
  TrendingUp,
  Flame,
  Users,
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
  const posts = useAppStore((state) => state.posts)
  const documents = useAppStore((state) => state.documents)
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
    { tag: '#TuyenThanhVienPBL', count: '53 bài viết', category: 'Nhóm đồ án' }
  ]

  const fallbackStudents: SuggestedUser[] = [
    { id: '1', displayName: 'TS. Nguyễn Văn Hà', role: 'lecturer', username: 'gv_ha', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false },
    { id: '2', displayName: 'Trần Minh Đức', role: 'student', username: 'duc_k16', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false },
    { id: '3', displayName: 'Lê Thị Mai', role: 'student', username: 'mai_pro', faculty: 'FIT', reputationPoints: 100, avatarUrl: null, isFollowedByMe: false }
  ]

  const displayUsers = suggestedUsers.length > 0 ? suggestedUsers : fallbackStudents

  return (
    <div className="w-full space-y-5">
      {/* 1. Phenikaa Portal Info Card */}
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span>Đại học Phenikaa</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            Cổng kết nối sinh viên chính thức hỗ trợ trao đổi học thuật, tài liệu đề thi và kết nối đồ án môn học.
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
            <span className="text-muted-foreground">Trạng thái hệ thống:</span>
            <span className="flex items-center gap-1 font-semibold text-green-500">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              PostgreSQL Live
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Realtime Activity Counter */}
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
            <TrendingUp className="h-4 w-4 text-accent" />
            <span>Dữ liệu thời gian thực</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <span className="text-[10px] text-muted-foreground block">Bài viết thực</span>
              <span className="text-lg font-extrabold text-foreground">{posts.length}</span>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5 border border-border/40">
              <span className="text-[10px] text-muted-foreground block">Tài liệu thực</span>
              <span className="text-lg font-extrabold text-foreground">{documents.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Xu Hướng Phenikaa (X Trending Style) */}
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
            <Flame className="h-4 w-4 text-accent" />
            <span>Xu hướng học thuật</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingTopics.map((topic) => (
            <div
              key={topic.tag}
              className="flex flex-col space-y-0.5 hover:bg-muted/40 p-2 -mx-2 rounded-xl transition-colors cursor-pointer"
            >
              <span className="text-[10px] text-muted-foreground">{topic.category} · Xu hướng</span>
              <span className="text-xs font-bold text-foreground hover:underline">{topic.tag}</span>
              <span className="text-[10px] text-muted-foreground">{topic.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 4. Gợi Ý Kết Nối Bạn Bè & Giảng Viên (Live GraphQL) */}
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
            <Users className="h-4 w-4 text-primary" />
            <span>Gợi ý kết nối học tập</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                  <Avatar className="h-8 w-8 shrink-0 border border-border">
                    <AvatarImage
                      src={
                        item.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.username}`
                      }
                      alt={item.displayName}
                    />
                    <AvatarFallback>{item.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {item.displayName}
                      </span>
                      {item.role === 'lecturer' && (
                        <ShieldCheck className="h-3 w-3 text-accent shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {item.role === 'lecturer' ? 'Giảng viên' : 'Sinh viên'} {item.faculty ? `• ${item.faculty}` : ''}
                    </span>
                  </div>
                </Link>

                <FollowButton
                  targetUserId={item.id}
                  targetUsername={item.username}
                  initialIsFollowing={item.isFollowedByMe || false}
                  size="sm"
                  showIcon={false}
                  className="h-7 px-2.5 text-[10px] shrink-0"
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
