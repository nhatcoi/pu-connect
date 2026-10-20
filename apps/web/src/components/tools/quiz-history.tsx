'use client'

import React from 'react'
import { Clock } from 'lucide-react'
import { useQuizAttempts } from '@/hooks/use-study-tools'
import { cn } from '@/lib/utils'
import { formatDuration } from './quiz-deck'

const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Lịch sử các lần làm quiz (study_events): điểm, số câu đúng, thời gian; thanh điểm để thấy tiến bộ
export function QuizHistory({ setId }: { setId: string }) {
  const { data, isPending } = useQuizAttempts(setId)
  if (isPending || !data?.length) return null
  return (
    <section className="rounded-2xl bg-card">
      <h2 className="px-4 pt-3 pb-1 text-sm font-semibold">Lịch sử làm bài</h2>
      <ul className="divide-y">
        {data.map((a) => (
          <li key={a.at} className="flex items-center gap-3 px-4 py-2 text-xs">
            <span className="w-24 shrink-0 text-muted-foreground tabular-nums">{when(a.at)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className={cn('block h-full rounded-full', a.score >= 80 ? 'bg-emerald-500' : a.score >= 50 ? 'bg-primary' : 'bg-amber-500')} style={{ width: `${a.score}%` }} />
            </span>
            <span className="w-9 shrink-0 text-right font-semibold tabular-nums">{a.score}%</span>
            <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">{a.correct != null && a.total != null ? `${a.correct}/${a.total}` : '—'}</span>
            <span className="flex w-12 shrink-0 items-center justify-end gap-0.5 text-muted-foreground tabular-nums">
              {a.seconds != null ? (
                <>
                  <Clock className="h-3 w-3" />
                  {formatDuration(a.seconds)}
                </>
              ) : (
                '—'
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
