'use client'

import React, { useState } from 'react'
import { Check, RotateCcw, Trophy, X } from 'lucide-react'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { QuizData } from './study-blocks'

// Quiz trắc nghiệm tương tác: chọn đáp án ⇒ hiện đúng/sai + giải thích, cuối cùng chấm điểm
export function QuizCard({ data }: { data: QuizData }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => data.questions.map(() => null))
  const answered = picked.filter((p) => p !== null).length
  const score = picked.reduce<number>((s, p, i) => s + (p === data.questions[i].answer ? 1 : 0), 0)
  const done = answered === data.questions.length

  return (
    <div className="not-prose my-2 rounded-xl border bg-background/60 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b bg-primary/5">
        <p className="text-xs font-semibold text-primary truncate">📝 {data.title || 'Quiz ôn tập'}</p>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {answered}/{data.questions.length}
        </span>
      </div>
      <ol className="divide-y">
        {data.questions.map((q, qi) => {
          const choice = picked[qi]
          return (
            <li key={qi} className="px-3.5 py-3 space-y-2">
              <div className="flex items-start gap-1.5 text-[13px] font-medium leading-snug">
                <span className="text-muted-foreground shrink-0">{qi + 1}.</span>
                <MarkdownPreview content={q.q} className="flex-1 min-w-0 text-[13px] leading-snug space-y-1 [&>p]:m-0" />
              </div>
              <div className="grid gap-1.5">
                {q.options.map((opt, oi) => {
                  const isAnswer = oi === q.answer
                  const isPicked = oi === choice
                  return (
                    <button
                      key={oi}
                      disabled={choice !== null}
                      onClick={() => setPicked((p) => p.map((v, i) => (i === qi ? oi : v)))}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] transition-colors',
                        choice === null && 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer',
                        choice !== null && isAnswer && 'border-emerald-500/60 bg-emerald-500/10',
                        choice !== null && isPicked && !isAnswer && 'border-destructive/60 bg-destructive/10',
                        choice !== null && !isAnswer && !isPicked && 'opacity-60'
                      )}
                    >
                      <span className="font-semibold text-muted-foreground w-4 shrink-0">{String.fromCharCode(65 + oi)}</span>
                      <MarkdownPreview content={opt} className="flex-1 min-w-0 text-[13px] leading-snug space-y-1 [&>p]:m-0" />
                      {choice !== null && isAnswer && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                      {isPicked && !isAnswer && <X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    </button>
                  )
                })}
              </div>
              {choice !== null && q.explain && (
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
                  <span className="shrink-0">💡</span>
                  <MarkdownPreview content={q.explain} className="flex-1 min-w-0 text-xs text-muted-foreground leading-relaxed space-y-1 [&>p]:m-0" />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {done && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-t bg-muted/40">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-500" /> {score}/{data.questions.length} câu đúng
          </p>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setPicked(data.questions.map(() => null))}>
            <RotateCcw className="h-3 w-3" /> Làm lại
          </Button>
        </div>
      )}
    </div>
  )
}
