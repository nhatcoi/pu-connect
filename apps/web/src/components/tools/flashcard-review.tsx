'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RotateCcw, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import type { ReviewGrade, StudyItem, StudySetDetail } from '@pu/schemas'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { Button } from '@/components/ui/button'
import { toolsApi } from '@/hooks/use-study-tools'
import { errorMessage } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { asCard } from './tool-catalog'

const GRADES: { grade: ReviewGrade; label: string; hint: string; key: string; className: string }[] = [
  { grade: 'again', label: 'Quên', hint: '10 phút', key: '1', className: 'border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10' },
  { grade: 'hard', label: 'Khó', hint: 'sớm hơn', key: '2', className: 'border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' },
  { grade: 'good', label: 'Nhớ', hint: 'vài ngày', key: '3', className: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' },
  { grade: 'easy', label: 'Dễ', hint: 'lâu hơn', key: '4', className: 'border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10' }
]

const isDue = (it: StudyItem, now: number) => !it.dueAt || new Date(it.dueAt).getTime() <= now

// Ôn thẻ: hàng đợi thẻ đến hạn (thẻ mới trước), lật ⇒ chấm ⇒ lịch ôn kế tiếp; "Quên" ⇒ gặp lại cuối phiên
// Phím tắt: Space lật · 1–4 chấm
export function FlashcardReview({ set }: { set: StudySetDetail }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'due' | 'all'>('due')
  const initialQueue = useMemo(() => {
    const now = Date.now()
    const items = mode === 'all' ? [...set.items] : set.items.filter((it) => isDue(it, now))
    return items.map((it) => it.id)
    // Chỉ dựng lại hàng đợi khi đổi chế độ / đổi bộ (không phải mỗi lần chấm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, set.id])
  const [queue, setQueue] = useState<string[]>(initialQueue)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setQueue(initialQueue)
    setFlipped(false)
    setDone(0)
  }, [initialQueue])

  const byId = useMemo(() => new Map(set.items.map((it) => [it.id, it])), [set.items])
  const current = queue[0] ? byId.get(queue[0]) : undefined

  const grade = useCallback(
    async (g: ReviewGrade) => {
      if (!current || busy) return
      setBusy(true)
      try {
        const res = await toolsApi.review(set.id, current.id, g)
        // Cập nhật cache bộ (lịch ôn thẻ + số thẻ đến hạn)
        qc.setQueryData<StudySetDetail>(queryKeys.toolSet(set.id), (old) =>
          old ? { ...old, dueCount: res.dueCount, items: old.items.map((it) => (it.id === res.item.id ? res.item : it)) } : old
        )
        setQueue((q) => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)))
        if (g !== 'again') setDone((n) => n + 1)
        setFlipped(false)
      } catch (err) {
        toast.error(errorMessage(err, 'Không lưu được lượt ôn'))
      } finally {
        setBusy(false)
      }
    },
    [current, busy, set.id, qc]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped) {
        const g = GRADES.find((x) => x.key === e.key)
        if (g) void grade(g.grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, grade])

  const finished = !current
  const total = done + queue.length

  if (finished) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-10 text-center space-y-3">
        <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
        <p className="font-semibold">{done ? `Xong phiên ôn — ${done} thẻ` : 'Không còn thẻ đến hạn'}</p>
        <p className="text-xs text-muted-foreground">Thẻ sẽ quay lại đúng lúc bạn sắp quên.</p>
        <div className="flex justify-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => setMode((m) => (m === 'all' ? 'due' : 'all'))}>
            <RotateCcw className="h-3.5 w-3.5" /> {mode === 'all' ? 'Chỉ thẻ đến hạn' : `Ôn tất cả ${set.items.length} thẻ`}
          </Button>
        </div>
      </div>
    )
  }

  const card = asCard(current.content)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {mode === 'all' ? 'Ôn tất cả' : 'Thẻ đến hạn'} · {done}/{total}
        </span>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => {
            setQueue((q) => [...q].sort(() => Math.random() - 0.5))
            setFlipped(false)
          }}
        >
          <Shuffle className="h-3.5 w-3.5" /> Xáo
        </button>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={cn(
          'w-full min-h-56 rounded-2xl border-2 px-6 py-8 flex flex-col items-center justify-center text-center gap-2 transition-colors bg-card',
          flipped ? 'border-primary/40 bg-primary/5' : 'border-dashed hover:border-primary/30'
        )}
      >
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {flipped ? 'Mặt sau' : 'Mặt trước'} · {current.reps ? `đã ôn ${current.reps} lần` : 'thẻ mới'}
        </span>
        <MarkdownPreview content={card.front} className={cn('leading-snug [&>p]:m-0', flipped ? 'text-sm text-muted-foreground' : 'text-lg font-semibold')} />
        {flipped && <MarkdownPreview content={card.back} className="text-[15px] leading-relaxed [&>p]:m-0 pt-2 border-t w-full" />}
        {!flipped && <span className="text-[11px] text-muted-foreground pt-2">Chạm hoặc nhấn Space để lật</span>}
      </button>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              type="button"
              disabled={busy}
              onClick={() => void grade(g.grade)}
              className={cn('rounded-xl border bg-card py-2 text-sm font-semibold transition-colors disabled:opacity-50', g.className)}
            >
              {g.label}
              <span className="block text-[10px] font-normal text-muted-foreground">
                {g.hint} · {g.key}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Button className="w-full rounded-xl" onClick={() => setFlipped(true)}>
          Lật thẻ
        </Button>
      )}
    </div>
  )
}
