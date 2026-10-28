'use client'

import React from 'react'
import Link from 'next/link'
import { BookOpen, FileText, GraduationCap, ShieldCheck } from 'lucide-react'
import type { UserProfileData } from '@/hooks/use-profile'
import { ProfileCompletionCard } from './profile-completion-card'

interface ProfileAsideProps {
  profile: UserProfileData
  isOwner: boolean
}

export function ProfileAside({ profile, isOwner }: ProfileAsideProps) {
  const documents = profile.documents || []

  return (
    <div className="w-full space-y-5">
      {/* 1. Nếu là chính mình: Hiển thị Thẻ tiến độ hoàn thiện hồ sơ */}
      {isOwner && <ProfileCompletionCard />}

      {/* 2. Tóm tắt thông tin học thuật */}
      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span>Hồ sơ học thuật</span>
        </h3>
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Vai trò</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              {profile.role === 'lecturer' ? 'Giảng viên' : 'Sinh viên chính quy'}
              {profile.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
            </span>
          </div>
          {profile.school && (
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Trường</span>
              <span className="font-medium text-foreground text-right truncate max-w-[150px]">{profile.school}</span>
            </div>
          )}
        </div>
      </section>

      {/* 3. Thống kê đóng góp học thuật */}
      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-primary" />
          <span>Đóng góp học tập</span>
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/60 bg-card p-2.5 text-center">
            <span className="block text-base font-bold text-foreground">{profile.posts?.length || 0}</span>
            <span className="text-[10px] text-muted-foreground">Bài viết</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-2.5 text-center">
            <span className="block text-base font-bold text-primary">{documents.length}</span>
            <span className="text-[10px] text-muted-foreground">Tài liệu</span>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-2.5 text-center">
            <span className="block text-base font-bold text-foreground">{profile.studyGroups?.length || 0}</span>
            <span className="text-[10px] text-muted-foreground">Nhóm học</span>
          </div>
        </div>
      </section>

      {/* 4. Tài liệu đã chia sẻ (nếu có) */}
      {documents.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" />
            <span>Tài liệu tiêu biểu</span>
          </h3>
          <div className="space-y-1">
            {documents.slice(0, 3).map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col rounded-xl px-3 py-2 border border-border/60 bg-card hover:bg-muted/60 transition-colors"
              >
                <span className="text-xs font-semibold text-foreground truncate">{doc.title}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {doc.downloadCount || 0} lượt tải
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Minimal Footer */}
      <div className="px-2 text-[11px] text-muted-foreground/70 space-y-1 pt-1">
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
