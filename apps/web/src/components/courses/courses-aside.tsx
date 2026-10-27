'use client'

import React from 'react'
import Link from 'next/link'
import { FileText, GraduationCap, HelpCircle, Sparkles } from 'lucide-react'

export function CoursesAside() {
  return (
    <div className="w-full space-y-5">
      {/* 1. Ôn thi cùng N7AI */}
      <section className="space-y-3 rounded-xl bg-brand-navy p-4 text-white">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-orange">
          <Sparkles className="h-3.5 w-3.5" /> N7AI
        </p>
        <div>
          <h3 className="text-base font-bold">Ôn thi cùng N7AI</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/75">Tạo đề thi thử, tóm tắt và quiz từ tài liệu của các môn bạn đang theo dõi.</p>
        </div>
        <Link href="/n7ai" className="flex h-9 items-center justify-center rounded-lg bg-brand-orange text-xs font-bold text-white transition-opacity hover:opacity-90">
          Tạo đề thi thử
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/n7ai" className="flex h-8 items-center justify-center rounded-lg border border-white/25 text-xs font-semibold transition-colors hover:bg-white/10">
            Tóm tắt
          </Link>
          <Link href="/tools/quiz" className="flex h-8 items-center justify-center rounded-lg border border-white/25 text-xs font-semibold transition-colors hover:bg-white/10">
            Quiz
          </Link>
        </div>
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
