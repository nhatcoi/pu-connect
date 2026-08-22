'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Award, Trophy, Star, ShieldCheck, Flame, BookOpen } from 'lucide-react'
import type { UserProfileData } from '@/hooks/use-profile'

interface ProfileBadgesTabProps {
  profile: UserProfileData
}

export function ProfileBadgesTab({ profile }: ProfileBadgesTabProps) {
  const badges = [
    {
      id: 'top-contributor',
      title: `Top Contributor ${profile.faculty || 'FIT'}`,
      description: 'Sinh viên tích cực đóng góp nhiều tài liệu và đề thi giá trị nhất cho Khoa.',
      icon: Trophy,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      isUnlocked: (profile.reputationPoints || 100) >= 300
    },
    {
      id: 'pbl-master',
      title: 'PBL Group Leader',
      description: 'Đã dẫn dắt và tuyển dụng thành công các nhóm đồ án môn học.',
      icon: Award,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      isUnlocked: profile.studyGroups && profile.studyGroups.length > 0
    },
    {
      id: 'knowledge-curator',
      title: 'Knowledge Curator',
      description: 'Chia sẻ trên 2 đề thi và slide bài giảng được xác thực.',
      icon: BookOpen,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      isUnlocked: profile.documents && profile.documents.length >= 1
    },
    {
      id: 'verified-phenikaa',
      title: 'Xác thực Phenikaa 365',
      description: 'Tài khoản đã liên kết email chính thức @phenikaa-uni.edu.vn.',
      icon: ShieldCheck,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      isUnlocked: true
    },
    {
      id: 'active-contributor',
      title: 'Active Thinker',
      description: 'Tham gia thảo luận và giải đáp bài tập trên diễn đàn học thuật.',
      icon: Flame,
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      isUnlocked: profile.posts && profile.posts.length > 0
    }
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Reputation Overview Card */}
      <Card className="bg-gradient-to-br from-amber-500/5 via-primary/5 to-transparent border-amber-500/20">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {profile.reputationPoints || 100}
                </span>
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium">
                  Cấp độ: {Math.floor((profile.reputationPoints || 100) / 100) + 1}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Điểm danh vọng được tích lũy qua lượt thích câu trả lời và đóng góp đề thi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          Huy hiệu danh dự ({badges.filter((b) => b.isUnlocked).length}/{badges.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {badges.map((badge) => {
            const Icon = badge.icon
            return (
              <div
                key={badge.id}
                className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all ${
                  badge.isUnlocked
                    ? 'bg-card border-border shadow-xs hover:border-primary/30'
                    : 'bg-muted/30 border-dashed border-border/60 opacity-60'
                }`}
              >
                <div
                  className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border ${badge.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {badge.title}
                    </span>
                    {!badge.isUnlocked && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        Chưa mở khóa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {badge.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
