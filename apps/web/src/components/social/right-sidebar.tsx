'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import {
  GraduationCap,
  TrendingUp,
  Flame,
  Users,
  Building2,
  Sparkles,
  ArrowRight,
  UserPlus
} from 'lucide-react'

export function RightSidebar() {
  const posts = useAppStore((state) => state.posts)
  const documents = useAppStore((state) => state.documents)
  const studyGroups = useAppStore((state) => state.studyGroups)

  const trendingTopics = [
    { tag: '#DoAnTotNghiep2026', count: '142 bài viết', category: 'K15 Đồ án' },
    { tag: '#OnThiGiaiTich2', count: '89 bài viết', category: 'Toán học' },
    { tag: '#PhenikaaX_Robocon', count: '64 bài viết', category: 'Công nghệ' },
    { tag: '#TuyenThanhVienPBL', count: '53 bài viết', category: 'Nhóm đồ án' }
  ]

  const suggestedStudents = [
    { name: 'TS. Nguyễn Văn Hà', role: 'Giảng viên FIT', avatar: 'GVHa', faculty: 'FIT' },
    { name: 'Trần Minh Đức', role: 'K16 Fullstack Dev', avatar: 'Duc', faculty: 'FIT' },
    { name: 'Lê Thị Mai', role: 'CLB Tin học PRO', avatar: 'Mai', faculty: 'FIT' }
  ]

  return (
    <div className="w-full space-y-5">
      {/* 1. Phenikaa Portal Info Card */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
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
      <Card className="rounded-2xl border-border bg-card shadow-sm">
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
      <Card className="rounded-2xl border-border bg-card shadow-sm">
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

      {/* 4. Gợi Ý Kết Nối Bạn Bè & Giảng Viên */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
            <Users className="h-4 w-4 text-primary" />
            <span>Gợi ý kết nối học tập</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedStudents.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.avatar}`}
                  alt={item.name}
                  className="h-8 w-8 rounded-full bg-muted shrink-0 border border-border"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{item.role}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-[10px] rounded-full shrink-0">
                Theo dõi
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
