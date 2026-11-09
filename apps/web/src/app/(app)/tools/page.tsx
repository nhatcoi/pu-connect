'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Flame, Wrench } from 'lucide-react'
import type { StudySetSummary } from '@pu/schemas'
import { Skeleton } from '@/components/ui/skeleton'
import { N7AiMark } from '@/components/brand/pu-logo'
import { StudySetRow } from '@/components/tools/study-set-row'
import { StudyStatsCard, type StudyAction } from '@/components/tools/study-stats-card'
import { TOOLS, toolHref } from '@/components/tools/tool-catalog'
import { useStudyStats, useToolsOverview } from '@/hooks/use-study-tools'
import { cn } from '@/lib/utils'

const SECONDS_PER_CARD = 8 // ước lượng thời gian ôn 1 thẻ

// Công cụ học tập: tiến độ học (kèm việc nên làm ngay) → loại công cụ → bộ gần đây
export default function ToolsPage() {
  const { data, isPending } = useToolsOverview()
  const { data: stats } = useStudyStats()
  const kinds = new Map(data?.kinds.map((k) => [k.kind, k]))
  const action = data ? nextAction(data.recent, kinds.get('flashcards')?.due ?? 0) : null

  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 flex items-center justify-between bg-surface/90 backdrop-blur-md px-4 py-3">
        <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Công cụ
        </h1>
        {stats && (
          <span
            title={stats.bestStreak ? `Kỷ lục ${stats.bestStreak} ngày` : 'Học mỗi ngày để tạo chuỗi'}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
              stats.streak ? 'bg-brand-orange/15 text-brand-orange' : 'bg-muted text-muted-foreground'
            )}
          >
            <Flame className="h-3.5 w-3.5" /> {stats.streak} ngày
          </span>
        )}
      </div>

      <div className="px-2 sm:px-0 space-y-6 pb-8">
        <StudyStatsCard action={action} />

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TOOLS.map((t) => {
            const s = kinds.get(t.kind)
            const Icon = t.icon
            return (
              <Link
                key={t.kind}
                href={toolHref(t.kind)}
                className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{t.tagline}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex items-end gap-5">
                  <Metric value={s?.sets ?? 0} label="bộ" />
                  <Metric value={s?.items ?? 0} label={t.itemLabel} />
                  {t.kind === 'flashcards' && !!s?.due && <Metric value={s.due} label="cần ôn" tone="due" />}
                </div>
              </Link>
            )
          })}
        </section>

        <section className="space-y-2">
          <h2 className="px-2 sm:px-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gần đây</h2>
          {isPending ? (
            <div className="space-y-px overflow-hidden rounded-2xl">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-none" />
              ))}
            </div>
          ) : data?.recent.length ? (
            <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
              {data.recent.map((s) => (
                <StudySetRow key={s.id} set={s} showKind flat />
              ))}
            </div>
          ) : (
            <EmptyRecent />
          )}
        </section>
      </div>
    </>
  )
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: 'due' }) {
  return (
    <span className="leading-none">
      <span className={cn('block text-xl font-bold tabular-nums', tone === 'due' && 'text-amber-600 dark:text-amber-400')}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  )
}

// Việc nên làm ngay (Anki "Study now" / Quizlet "Continue"): bộ có nhiều thẻ đến hạn nhất → quiz chưa làm → null
function nextAction(recent: StudySetSummary[], due: number): StudyAction | null {
  const topDeck = recent.filter((s) => s.kind === 'flashcards' && s.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount)[0]
  if (topDeck) {
    const minutes = Math.max(1, Math.round((due * SECONDS_PER_CARD) / 60))
    return { href: toolHref('flashcards', topDeck.id), label: `Ôn ${due} thẻ`, hint: `${topDeck.title} · khoảng ${minutes} phút` }
  }
  const todoQuiz = recent.find((s) => s.kind === 'quiz' && s.bestScore == null)
  return todoQuiz ? { href: toolHref('quiz', todoQuiz.id), label: 'Làm quiz', hint: `${todoQuiz.title} · ${todoQuiz.itemCount} câu` } : null
}

function EmptyRecent() {
  return (
    <div className="space-y-1 rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      <N7AiMark className="mx-auto h-6 w-6" />
      <p>Chưa có bộ nào.</p>
      <p className="text-xs">Mở một công cụ để tạo, hoặc nhờ N7AI ở chế độ Flashcard / Quiz.</p>
    </div>
  )
}
