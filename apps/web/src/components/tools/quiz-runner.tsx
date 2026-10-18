'use client'

import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, RotateCcw, Trophy, X } from 'lucide-react'
import type { StudySetDetail } from '@pu/schemas'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { Button } from '@/components/ui/button'
import { toolsApi } from '@/hooks/use-study-tools'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { asQuestion } from './tool-catalog'

// Làm quiz: từng câu, chọn ⇒ xem đúng/sai + giải thích; hết bài ⇒ điểm, lưu điểm cao nhất
// Câu trước / sau tự do (bỏ qua được, câu bỏ trống tính sai) · phím ← →
export function QuizRunner({ set }: { set: StudySetDetail }) {
  const qc = useQueryClient()
  const [pos, setPos] = useState(0)
  const [picked, setPicked] = useState<(number | null)[]>(() => set.items.map(() => null))
  const [finished, setFinished] = useState(false)

  const total = set.items.length
  const item = set.items[pos]
  const q = item ? asQuestion(item.content) : null
  const choice = picked[pos]
  const correct = picked.filter((p, i) => p !== null && p === asQuestion(set.items[i].content).answer).length
  const unanswered = picked.filter((p) => p === null).length

  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setPos((p) => Math.min(total - 1, p + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, total])

  const finish = () => {
    setFinished(true)
    toolsApi
      .attempt(set.id, correct, total)
      .then((summary) => {
        qc.setQueryData<StudySetDetail>(queryKeys.toolSet(set.id), (old) => (old ? { ...old, ...summary } : old))
        void qc.invalidateQueries({ queryKey: queryKeys.toolsAll, predicate: (k) => k.queryKey[1] !== 'set' })
      })
      .catch(() => undefined)
  }
  const restart = () => {
    setPicked(set.items.map(() => null))
    setPos(0)
    setFinished(false)
  }

  if (finished || !q) {
    const pct = total ? Math.round((correct / total) * 100) : 0
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border bg-card px-6 py-8 text-center space-y-2">
          <Trophy className={cn('mx-auto h-9 w-9', pct >= 80 ? 'text-amber-500' : 'text-muted-foreground')} />
          <p className="text-2xl font-bold">
            {correct}/{total} <span className="text-base font-medium text-muted-foreground">· {pct}%</span>
          </p>
          <p className="text-xs text-muted-foreground">{set.bestScore != null ? `Điểm cao nhất: ${Math.max(set.bestScore, pct)}%` : 'Lần làm đầu tiên'}</p>
          <Button size="sm" variant="outline" className="rounded-full gap-1 mt-1" onClick={restart}>
            <RotateCcw className="h-3.5 w-3.5" /> Làm lại
          </Button>
        </div>
        {/* Xem lại câu sai */}
        <div className="space-y-2">
          {set.items.map((it, i) => {
            const qq = asQuestion(it.content)
            const ok = picked[i] === qq.answer
            return (
              <div key={it.id} className="rounded-xl border bg-card px-3.5 py-2.5 text-sm">
                <div className="flex items-start gap-1.5 font-medium">
                  {ok ? <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" /> : <X className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />}
                  <MarkdownPreview content={`${i + 1}. ${qq.q}`} className="[&>p]:m-0" />
                </div>
                {!ok && (
                  <p className="pl-5.5 text-xs text-muted-foreground mt-1">
                    Đáp án: <span className="text-foreground font-medium">{qq.options[qq.answer]}</span>
                    {qq.explain ? ` — ${qq.explain}` : ''}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Câu {pos + 1}/{total}
        </span>
        <span>
          Đúng {correct}
          {unanswered ? ` · ${unanswered} chưa làm` : ''}
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${((total - unanswered) / total) * 100}%` }} />
      </div>
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <MarkdownPreview content={q.q} className="text-[15px] font-semibold leading-snug [&>p]:m-0" />
        <div className="space-y-2">
          {q.options.map((o, i) => {
            const show = choice !== null
            const isAnswer = i === q.answer
            return (
              <button
                key={i}
                type="button"
                disabled={show}
                onClick={() => setPicked((p) => p.map((v, j) => (j === pos ? i : v)))}
                className={cn(
                  'w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  !show && 'hover:border-primary/40 hover:bg-primary/5',
                  show && isAnswer && 'border-emerald-500/60 bg-emerald-500/10',
                  show && choice === i && !isAnswer && 'border-red-500/60 bg-red-500/10'
                )}
              >
                <span className="font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                <MarkdownPreview content={o} className="[&>p]:m-0 flex-1" />
              </button>
            )
          })}
        </div>
        {choice !== null && q.explain && <p className="text-xs text-muted-foreground border-t pt-2">💡 {q.explain}</p>}
      </div>
      <div className="flex justify-between gap-2">
        <Button variant="outline" size="sm" className="gap-1" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>
          <ChevronLeft className="h-4 w-4" /> Câu trước
        </Button>
        {pos < total - 1 && (
          <Button variant={choice === null ? 'outline' : 'default'} size="sm" className="gap-1" onClick={() => setPos((p) => p + 1)}>
            {choice === null ? 'Bỏ qua' : 'Câu tiếp'} <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      {(pos === total - 1 || !unanswered) && (
        <Button className="w-full rounded-xl" onClick={finish}>
          Nộp bài{unanswered ? ` (${unanswered} câu bỏ trống)` : ''}
        </Button>
      )}
    </div>
  )
}
