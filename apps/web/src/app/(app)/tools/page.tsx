'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Wrench } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { N7AiMark } from '@/components/brand/pu-logo'
import { StudySetRow } from '@/components/tools/study-set-row'
import { StudyStatsCard } from '@/components/tools/study-stats-card'
import { TOOLS, toolHref } from '@/components/tools/tool-catalog'
import { useToolsOverview } from '@/hooks/use-study-tools'

// Công cụ học tập: các loại công cụ + bộ dùng gần đây
export default function ToolsPage() {
  const { data, isPending } = useToolsOverview()
  const stats = new Map(data?.kinds.map((k) => [k.kind, k]))

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3">
        <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Công cụ
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Tự soạn hoặc để N7AI tạo. Flashcard, quiz N7AI tạo trong chat tự lưu ở đây.</p>
      </div>

      <div className="px-2 sm:px-0 space-y-5 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TOOLS.map((t) => {
            const s = stats.get(t.kind)
            const Icon = t.icon
            return (
              <Link key={t.kind} href={toolHref(t.kind)} className="group rounded-2xl bg-card p-4 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-sm">{t.label}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">{t.tagline}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{s?.sets ?? 0} bộ</span>
                  <span>
                    {s?.items ?? 0} {t.itemLabel}
                  </span>
                  {t.kind === 'flashcards' && !!s?.due && <span className="font-medium text-amber-700 dark:text-amber-400">{s.due} cần ôn hôm nay</span>}
                </div>
              </Link>
            )
          })}
        </div>

        <StudyStatsCard />

        <section className="space-y-2">
          <h2 className="px-2 sm:px-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gần đây</h2>
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : data?.recent.length ? (
            data.recent.map((s) => <StudySetRow key={s.id} set={s} showKind />)
          ) : (
            <div className="rounded-2xl bg-card px-4 py-8 text-center text-sm text-muted-foreground space-y-1">
              <N7AiMark className="mx-auto h-6 w-6" />
              <p>Chưa có bộ nào.</p>
              <p className="text-xs">Mở một công cụ để tạo, hoặc nhờ N7AI ở chế độ Flashcard / Quiz.</p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
