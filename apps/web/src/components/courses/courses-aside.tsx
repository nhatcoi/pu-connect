'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { FileText, Flame, GraduationCap, HelpCircle, Sparkles } from 'lucide-react'
import { useCourses } from '@/hooks/use-course'
import { Skeleton } from '@/components/ui/skeleton'

export function CoursesAside() {
  const { data: courses = [], isPending } = useCourses()

  // Top 4 học phần sôi nổi nhất tính theo số lượng tài liệu + thảo luận
  const topCourses = useMemo(() => {
    return courses
      .slice()
      .sort((a, b) => b.documentCount + b.postCount - (a.documentCount + a.postCount))
      .slice(0, 4)
  }, [courses])

  return (
    <div className="w-full space-y-5">
      {/* 1. Học phần sôi nổi */}
      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-brand-orange" />
          <span>Học phần sôi nổi</span>
        </h3>
        {isPending ? (
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {topCourses.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${encodeURIComponent(c.code)}`}
                className="group flex flex-col rounded-xl px-3 py-2 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary font-mono group-hover:underline">{c.code}</span>
                  <span className="text-[10px] text-muted-foreground">{c.credits} tín chỉ</span>
                </div>
                <span className="text-[13px] font-medium text-foreground truncate mt-0.5">{c.name}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {c.documentCount} tài liệu · {c.postCount} thảo luận
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 2. Lối tắt học thuật Phenikaa */}
      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span>Kho tài nguyên học tập</span>
        </h3>
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2.5">
          <Link
            href="/search?type=documents"
            className="flex items-start gap-2.5 text-xs text-muted-foreground hover:text-foreground group transition-colors"
          >
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="block font-semibold text-foreground group-hover:text-primary">Đề thi & Tài liệu môn học</span>
              <span className="text-[11px] text-muted-foreground">Đề thi giữa kỳ, cuối kỳ K14-K17</span>
            </div>
          </Link>

          <Link
            href="/search?type=qa"
            className="flex items-start gap-2.5 text-xs text-muted-foreground hover:text-foreground group transition-colors"
          >
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <HelpCircle className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="block font-semibold text-foreground group-hover:text-primary">Hỏi đáp & Luyện đề</span>
              <span className="text-[11px] text-muted-foreground">Giải đáp bài tập cùng cộng đồng</span>
            </div>
          </Link>

          <Link
            href="/n7ai"
            className="flex items-start gap-2.5 text-xs text-muted-foreground hover:text-foreground group transition-colors"
          >
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="block font-semibold text-foreground group-hover:text-primary">Ôn thi cùng N7AI</span>
              <span className="text-[11px] text-muted-foreground">Tạo đề thi thử, tóm tắt và quiz</span>
            </div>
          </Link>
        </div>
      </section>

      {/* 3. Sleek Minimal Footer */}
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
