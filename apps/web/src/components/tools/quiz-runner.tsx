'use client'

import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Clock, RotateCcw, Settings2, Shuffle, Trophy, X } from 'lucide-react'
import type { StudyItem, StudySetDetail } from '@pu/schemas'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toolsApi } from '@/hooks/use-study-tools'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { DEFAULT_RUN_OPTIONS, TIME_LIMIT_CHOICES, buildDeck, formatDuration, isDeckCorrect, rightAnswers, type DeckQuestion, type QuizRunOptions } from './quiz-deck'
import { QuizHistory } from './quiz-history'

interface Session {
  id: number
  deck: DeckQuestion[]
  options: QuizRunOptions
  scored: boolean // false = luyện lại câu sai, không ghi điểm
}

// Làm quiz: màn bắt đầu (trộn câu / lựa chọn, giới hạn giờ) → làm bài (đồng hồ, câu 1 / nhiều đáp án, Đúng/Sai) → kết quả (xem lại, luyện câu sai, lịch sử)
export function QuizRunner({ set }: { set: StudySetDetail }) {
  const [options, setOptions] = useState<QuizRunOptions>(DEFAULT_RUN_OPTIONS)
  const [session, setSession] = useState<Session | null>(null)

  const start = (opts: QuizRunOptions, items: StudyItem[] = set.items, scored = true) =>
    setSession((prev) => ({ id: (prev?.id ?? 0) + 1, deck: buildDeck(items, opts), options: opts, scored }))

  if (!session) {
    return (
      <div className="space-y-3">
        <QuizSetup total={set.items.length} options={options} onChange={setOptions} onStart={() => start(options)} />
        <QuizHistory setId={set.id} />
      </div>
    )
  }
  return (
    <QuizSession
      key={session.id}
      set={set}
      session={session}
      onRestart={() => start(session.options)}
      onPractice={(ids) => start(session.options, set.items.filter((it) => ids.has(it.id)), false)}
      onSetup={() => setSession(null)}
    />
  )
}

function QuizSetup({ total, options, onChange, onStart }: { total: number; options: QuizRunOptions; onChange: (o: QuizRunOptions) => void; onStart: () => void }) {
  const toggles = [
    { key: 'shuffleQuestions', label: 'Trộn thứ tự câu hỏi' },
    { key: 'shuffleOptions', label: 'Trộn thứ tự lựa chọn' }
  ] as const
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Settings2 className="h-4 w-4 text-muted-foreground" /> Sẵn sàng làm {total} câu?
      </p>
      <div className="space-y-2">
        {toggles.map((t) => (
          <label key={t.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <Shuffle className="h-3.5 w-3.5 text-muted-foreground" /> {t.label}
            </span>
            <Switch checked={options[t.key]} onCheckedChange={(v) => onChange({ ...options, [t.key]: v })} aria-label={t.label} />
          </label>
        ))}
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Giới hạn thời gian
          </span>
          <select
            value={options.timeLimitMinutes ?? ''}
            onChange={(e) => onChange({ ...options, timeLimitMinutes: e.target.value ? Number(e.target.value) : null })}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            aria-label="Giới hạn thời gian"
          >
            <option value="">Không giới hạn</option>
            {TIME_LIMIT_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m} phút
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button className="w-full rounded-xl" onClick={onStart}>
        Bắt đầu làm bài
      </Button>
    </div>
  )
}

const optionLetter = (i: number) => String.fromCharCode(65 + i)

function QuizSession({
  set,
  session,
  onRestart,
  onPractice,
  onSetup
}: {
  set: StudySetDetail
  session: Session
  onRestart: () => void
  onPractice: (ids: Set<string>) => void
  onSetup: () => void
}) {
  const qc = useQueryClient()
  const { deck, options, scored } = session
  const total = deck.length
  const [pos, setPos] = useState(0)
  // picked: đáp án đã chốt (null = chưa làm) · drafts: lựa chọn đang chọn dở của câu nhiều đáp án
  const [picked, setPicked] = useState<(number[] | null)[]>(() => deck.map(() => null))
  const [drafts, setDrafts] = useState<number[][]>(() => deck.map(() => []))
  const [finished, setFinished] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [seconds, setSeconds] = useState(0)
  const [onlyWrong, setOnlyWrong] = useState(false)

  const q = deck[pos]
  const chosen = picked[pos]
  const locked = chosen !== null
  const selected = chosen ?? drafts[pos] ?? []
  const isMulti = q?.content.type === 'multi'
  const correct = deck.filter((d, i) => isDeckCorrect(d, picked[i])).length
  const unanswered = picked.filter((p) => p === null).length
  const limitSeconds = options.timeLimitMinutes ? options.timeLimitMinutes * 60 : null
  const elapsed = Math.floor((now - startedAt) / 1000)

  useEffect(() => {
    if (finished) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [finished])

  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setPos((p) => Math.min(total - 1, p + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, total])

  const finish = () => {
    if (finished) return
    const took = Math.floor((Date.now() - startedAt) / 1000)
    setSeconds(took)
    setFinished(true)
    if (!scored) return
    toolsApi
      .attempt(set.id, correct, total, took)
      .then((summary) => {
        qc.setQueryData<StudySetDetail>(queryKeys.toolSet(set.id), (old) => (old ? { ...old, ...summary } : old))
        void qc.invalidateQueries({ queryKey: queryKeys.toolsAll, predicate: (k) => k.queryKey[1] !== 'set' })
      })
      .catch(() => undefined)
  }
  // Hết giờ ⇒ tự nộp (câu bỏ trống tính sai)
  useEffect(() => {
    if (!finished && limitSeconds !== null && elapsed >= limitSeconds) finish()
  })

  const commit = (answer: number[]) => setPicked((p) => p.map((v, j) => (j === pos ? answer : v)))
  const onOption = (index: number) => {
    if (locked) return
    if (!isMulti) return commit([index])
    setDrafts((d) => d.map((v, j) => (j === pos ? (v.includes(index) ? v.filter((x) => x !== index) : [...v, index]) : v)))
  }

  if (finished) {
    const pct = total ? Math.round((correct / total) * 100) : 0
    const wrongIds = new Set(deck.filter((d, i) => !isDeckCorrect(d, picked[i])).map((d) => d.itemId))
    const shown = deck.map((d, i) => ({ d, i })).filter(({ d }) => !onlyWrong || wrongIds.has(d.itemId))
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border bg-card px-6 py-8 text-center space-y-2">
          <Trophy className={cn('mx-auto h-9 w-9', pct >= 80 ? 'text-amber-500' : 'text-muted-foreground')} />
          <p className="text-2xl font-bold">
            {correct}/{total} <span className="text-base font-medium text-muted-foreground">· {pct}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Thời gian {formatDuration(seconds)}
            {' · '}
            {!scored ? 'Luyện tập, không tính điểm' : set.bestScore != null ? `Điểm cao nhất: ${Math.max(set.bestScore, pct)}%` : 'Lần làm đầu tiên'}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={onRestart}>
              <RotateCcw className="h-3.5 w-3.5" /> Làm lại
            </Button>
            {wrongIds.size > 0 && (
              <Button size="sm" className="rounded-full gap-1" onClick={() => onPractice(wrongIds)}>
                Luyện {wrongIds.size} câu sai
              </Button>
            )}
            <Button size="sm" variant="ghost" className="rounded-full gap-1" onClick={onSetup}>
              <Settings2 className="h-3.5 w-3.5" /> Đổi cấu hình
            </Button>
          </div>
        </div>

        {wrongIds.size > 0 && (
          <label className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            Chỉ hiện câu sai
            <Switch checked={onlyWrong} onCheckedChange={setOnlyWrong} aria-label="Chỉ hiện câu sai" />
          </label>
        )}
        <div className="space-y-2">
          {shown.map(({ d, i }) => {
            const ok = isDeckCorrect(d, picked[i])
            const mine = picked[i]
            const text = (idx: number[]) => idx.map((x) => d.content.options[x]).join('; ')
            return (
              <div key={d.itemId} className="rounded-xl border bg-card px-3.5 py-2.5 text-sm">
                <div className="flex items-start gap-1.5 font-medium">
                  {ok ? <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" /> : <X className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />}
                  <MarkdownPreview content={`${i + 1}. ${d.content.q}`} className="[&>p]:m-0" />
                </div>
                {!ok && (
                  <div className="pl-5.5 mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <p>
                      Bạn chọn: <span className="text-red-600 dark:text-red-400 font-medium">{mine?.length ? text(mine) : 'bỏ trống'}</span>
                    </p>
                    <p>
                      Đáp án: <span className="text-foreground font-medium">{text(rightAnswers(d))}</span>
                      {d.content.explain ? ` — ${d.content.explain}` : ''}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const remaining = limitSeconds !== null ? Math.max(0, limitSeconds - elapsed) : null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Câu {pos + 1}/{total}
          {!scored && ' · Luyện tập'}
        </span>
        <span className="flex items-center gap-3">
          <span>
            Đúng {correct}
            {unanswered ? ` · ${unanswered} chưa làm` : ''}
          </span>
          <span className={cn('flex items-center gap-1 tabular-nums', remaining !== null && remaining <= 30 && 'font-semibold text-red-500')}>
            <Clock className="h-3 w-3" />
            {formatDuration(remaining ?? elapsed)}
          </span>
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${((total - unanswered) / total) * 100}%` }} />
      </div>
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <MarkdownPreview content={q.content.q} className="text-[15px] font-semibold leading-snug [&>p]:m-0" />
        {isMulti && <p className="text-[11px] text-muted-foreground">Chọn tất cả đáp án đúng</p>}
        <div className="space-y-2">
          {q.shown.map((o, i) => {
            const isAnswer = rightAnswers(q).includes(o.index)
            const isSelected = selected.includes(o.index)
            return (
              <button
                key={o.index}
                type="button"
                disabled={locked}
                onClick={() => onOption(o.index)}
                aria-pressed={isSelected}
                className={cn(
                  'w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  !locked && 'hover:border-primary/40 hover:bg-primary/5',
                  !locked && isSelected && 'border-primary bg-primary/10',
                  locked && isAnswer && 'border-emerald-500/60 bg-emerald-500/10',
                  locked && isSelected && !isAnswer && 'border-red-500/60 bg-red-500/10'
                )}
              >
                <span className="font-semibold text-muted-foreground">{isMulti ? (isSelected ? '☑' : '☐') : `${optionLetter(i)}.`}</span>
                <MarkdownPreview content={o.text} className="[&>p]:m-0 flex-1" />
              </button>
            )
          })}
        </div>
        {isMulti && !locked && (
          <Button size="sm" className="rounded-full" disabled={!selected.length} onClick={() => commit(drafts[pos])}>
            Kiểm tra đáp án
          </Button>
        )}
        {locked && q.content.explain && <p className="text-xs text-muted-foreground border-t pt-2">💡 {q.content.explain}</p>}
      </div>
      <div className="flex justify-between gap-2">
        <Button variant="outline" size="sm" className="gap-1" disabled={pos === 0} onClick={() => setPos((p) => p - 1)}>
          <ChevronLeft className="h-4 w-4" /> Câu trước
        </Button>
        {pos < total - 1 && (
          <Button variant={locked ? 'default' : 'outline'} size="sm" className="gap-1" onClick={() => setPos((p) => p + 1)}>
            {locked ? 'Câu tiếp' : 'Bỏ qua'} <ChevronRight className="h-4 w-4" />
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
