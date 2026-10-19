'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Settings2, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import type { FlashcardContent, ReviewGrade, StudyItem, StudySetDetail } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { toolsApi } from '@/hooks/use-study-tools'
import { errorMessage } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { clozeAnswers, clozePlain, isClozeCard } from './card-cloze'
import { speechText, useSpeech } from './card-speech'
import { CardImage, MeaningFace, TermFace } from './flashcard-face'
import { asCard, hasSpeech } from './tool-catalog'

const GRADES: { grade: ReviewGrade; label: string; hint: string; key: string; className: string }[] = [
  { grade: 'again', label: 'Quên', hint: '10 phút', key: '1', className: 'border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10' },
  { grade: 'hard', label: 'Khó', hint: 'sớm hơn', key: '2', className: 'border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' },
  { grade: 'good', label: 'Nhớ', hint: 'vài ngày', key: '3', className: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' },
  { grade: 'easy', label: 'Dễ', hint: 'lâu hơn', key: '4', className: 'border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10' }
]

// Cách ôn (tùy chọn từng phiên, không gắn vào bộ): lật thẻ · đảo mặt (nhìn nghĩa đoán từ) · gõ đáp án · trắc nghiệm
// Thẻ điền chỗ trống: đảo mặt ⇒ như lật thẻ; gõ / trắc nghiệm ⇒ điền phần bị ẩn
type ReviewMode = 'flip' | 'reverse' | 'type' | 'choice'
const MODES: { mode: ReviewMode; label: string; hint: string }[] = [
  { mode: 'flip', label: 'Lật thẻ', hint: 'Nhìn mặt trước, nhớ mặt sau' },
  { mode: 'reverse', label: 'Đảo mặt', hint: 'Nhìn nghĩa, nhớ từ' },
  { mode: 'type', label: 'Gõ đáp án', hint: 'Nhìn nghĩa, gõ lại từ' },
  { mode: 'choice', label: 'Trắc nghiệm', hint: 'Nhìn từ, chọn nghĩa đúng (đáp án nhiễu lấy từ thẻ khác)' }
]

// Tùy chọn ôn của người xem (chỉ trình duyệt này) / Per-viewer review preferences
type Prefs = { mode: ReviewMode; autoSpeak: boolean }
const PREFS_KEY = 'pu.tools.flashcards.review'
function useReviewPrefs() {
  const [prefs, setPrefs] = useState<Prefs>({ mode: 'flip', autoSpeak: false })
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
      if (saved && MODES.some((m) => m.mode === saved.mode)) setPrefs({ mode: saved.mode!, autoSpeak: !!saved.autoSpeak })
    } catch {
      // localStorage bị chặn ⇒ dùng mặc định
    }
  }, [])
  const update = useCallback(
    (patch: Partial<Prefs>) =>
      setPrefs((p) => {
        const next = { ...p, ...patch }
        try {
          localStorage.setItem(PREFS_KEY, JSON.stringify(next))
        } catch {
          // bỏ qua
        }
        return next
      }),
    []
  )
  return [prefs, update] as const
}

// So khớp đáp án gõ: bỏ dấu, hoa thường, loại từ "(n)", ký tự thừa; mặt trước "a / b" ⇒ gõ 1 trong 2 cũng đúng
const normalize = (s: string) =>
  speechText(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
const matches = (typed: string, front: string) => {
  const t = normalize(typed)
  return !!t && (t === normalize(front) || front.split(/[/,;]/).some((alt) => normalize(alt) === t))
}

// Thẻ điền chỗ trống: gõ đủ các phần bị ẩn (theo thứ tự), 1 chỗ trống thì chấp nhận cả biến thể "a / b"
const matchesCloze = (typed: string, answers: string[]) =>
  normalize(typed) === normalize(answers.join(' ')) || (answers.length === 1 && matches(typed, answers[0]))

const isDue = (it: StudyItem, now: number) => !it.dueAt || new Date(it.dueAt).getTime() <= now

// Đáp án dùng cho trắc nghiệm: nghĩa (mặt sau) hoặc các phần bị ẩn
const answerOf = (c: FlashcardContent) => (isClozeCard(c) ? clozeAnswers(c.front).join(', ') : c.back)
const CHOICES = 4

// Trắc nghiệm: đáp án đúng + tối đa 3 đáp án nhiễu từ thẻ khác cùng dạng; không đủ thẻ ⇒ null (về lật thẻ)
function buildChoices(current: StudyItem, items: StudyItem[]): { options: string[]; answer: number } | null {
  const card = asCard(current.content)
  const cloze = isClozeCard(card)
  const right = answerOf(card)
  const seen = new Set([normalize(right)])
  const pool: string[] = []
  for (const it of [...items].sort(() => Math.random() - 0.5)) {
    const c = asCard(it.content)
    if (it.id === current.id || isClozeCard(c) !== cloze) continue
    const a = answerOf(c)
    if (!a || seen.has(normalize(a))) continue
    seen.add(normalize(a))
    pool.push(a)
    if (pool.length === CHOICES - 1) break
  }
  if (!pool.length) return null
  const options = [...pool, right].sort(() => Math.random() - 0.5)
  return { options, answer: options.indexOf(right) }
}

// Ôn thẻ: hàng đợi thẻ đến hạn (thẻ mới trước), lật ⇒ chấm ⇒ lịch ôn kế tiếp; "Quên" ⇒ gặp lại cuối phiên
// Trước / Sau: quay lại thẻ vừa xem hoặc bỏ qua thẻ (chưa chấm ⇒ dời cuối hàng)
// Phím tắt: Space lật · 1–4 chấm · ← → trước / sau · P phát âm
export function FlashcardReview({ set }: { set: StudySetDetail }) {
  const qc = useQueryClient()
  const [prefs, setPrefs] = useReviewPrefs()
  const { supported: canSpeak, speaking, speak } = useSpeech()
  const speechOn = canSpeak && hasSpeech(set.options)
  const [scope, setScope] = useState<'due' | 'all'>('due')
  const initialQueue = useMemo(() => {
    const now = Date.now()
    const items = scope === 'all' ? [...set.items] : set.items.filter((it) => isDue(it, now))
    return items.map((it) => it.id)
    // Chỉ dựng lại hàng đợi khi đổi phạm vi / đổi bộ (không phải mỗi lần chấm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, set.id])
  const [queue, setQueue] = useState<string[]>(initialQueue)
  // Thẻ đã xem (để quay lại) · thẻ đã chấm nhớ (đếm tiến độ, không trùng)
  const [history, setHistory] = useState<string[]>([])
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(() => new Set())
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  // Gõ đáp án: nội dung gõ + kết quả (null = chưa kiểm)
  const [typed, setTyped] = useState('')
  const [correct, setCorrect] = useState<boolean | null>(null)
  // Trắc nghiệm: lựa chọn đã bấm
  const [picked, setPicked] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setQueue(initialQueue)
    setHistory([])
    setDoneIds(new Set())
    setFlipped(false)
  }, [initialQueue])

  const byId = useMemo(() => new Map(set.items.map((it) => [it.id, it])), [set.items])
  const current = queue[0] ? byId.get(queue[0]) : undefined
  const card = current ? asCard(current.content) : null
  const cloze = !!card && isClozeCard(card)
  // Đáp án trắc nghiệm: dựng lại khi sang thẻ khác (không xáo lại khi cache bộ đổi giữa chừng)
  const choices = useMemo(
    () => (current && prefs.mode === 'choice' ? buildChoices(current, set.items) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, prefs.mode]
  )
  // Cách ôn áp cho thẻ này: điền chỗ trống không đảo mặt; trắc nghiệm thiếu thẻ nhiễu ⇒ lật thẻ
  const mode: ReviewMode = (prefs.mode === 'reverse' && cloze) || (prefs.mode === 'choice' && !choices) ? 'flip' : prefs.mode
  // Mặt từ đang hiện đầy đủ? (điền chỗ trống / đảo mặt / gõ: sau khi lật)
  const termVisible = cloze ? flipped : mode === 'flip' || mode === 'choice' || flipped

  // Thẻ mới / đổi cách ôn ⇒ úp thẻ, xóa ô gõ / lựa chọn
  useEffect(() => {
    setTyped('')
    setCorrect(null)
    setPicked(null)
  }, [current?.id, mode])
  useEffect(() => setFlipped(false), [mode])
  useEffect(() => {
    if (mode === 'type' && !flipped) inputRef.current?.focus()
  }, [mode, flipped, current?.id])

  const speakTerm = useCallback(() => {
    if (card && speechOn) speak(cloze ? clozePlain(card.front) : card.front, set.options.lang)
  }, [card, cloze, speechOn, speak, set.options.lang])
  // Tự đọc khi mặt từ vừa hiện
  useEffect(() => {
    if (prefs.autoSpeak && termVisible) speakTerm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.autoSpeak, termVisible, current?.id])

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
        // Tổng quan / thống kê / danh sách cũ đi (không refetch ngay nếu không đang mở)
        void qc.invalidateQueries({ queryKey: queryKeys.toolsAll, predicate: (k) => k.queryKey[1] !== 'set' })
        setHistory((h) => [...h, current.id])
        setQueue((q) => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)))
        setDoneIds((d) => {
          const next = new Set(d)
          if (g === 'again') next.delete(current.id)
          else next.add(current.id)
          return next
        })
        setFlipped(false)
      } catch (err) {
        toast.error(errorMessage(err, 'Không lưu được lượt ôn'))
      } finally {
        setBusy(false)
      }
    },
    [current, busy, set.id, qc]
  )

  // Quay lại thẻ vừa xem: đưa lên đầu hàng (bỏ bản trùng nếu thẻ đang chờ ở cuối)
  const prev = useCallback(() => {
    const last = history.at(-1)
    if (!last || busy) return
    setHistory((h) => h.slice(0, -1))
    setQueue((q) => [last, ...q.filter((id) => id !== last)])
    setFlipped(false)
  }, [history, busy])

  // Bỏ qua thẻ chưa chấm: dời xuống cuối hàng
  const next = useCallback(() => {
    if (!current || busy || queue.length < 2) return
    setHistory((h) => [...h, current.id])
    setQueue((q) => [...q.slice(1), q[0]])
    setFlipped(false)
  }, [current, busy, queue.length])

  // Gõ đáp án: kiểm ⇒ lật, gợi ý chấm (đúng ⇒ Nhớ, sai ⇒ Quên)
  const check = useCallback(() => {
    if (!card) return
    setCorrect(cloze ? matchesCloze(typed, clozeAnswers(card.front)) : matches(typed, card.front))
    setFlipped(true)
    inputRef.current?.blur()
  }, [card, cloze, typed])
  // Trắc nghiệm: chọn ⇒ lật + gợi ý chấm
  const pick = useCallback(
    (i: number) => {
      if (!choices || flipped || i >= choices.options.length) return
      setPicked(i)
      setCorrect(i === choices.answer)
      setFlipped(true)
    },
    [choices, flipped]
  )
  const suggested: ReviewGrade | null = (mode === 'type' || mode === 'choice') && correct !== null ? (correct ? 'good' : 'again') : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (mode === 'type' && !flipped) check()
        else setFlipped((f) => !f)
      } else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key.toLowerCase() === 'p' && termVisible) speakTerm()
      else if (e.key === 'Enter' && suggested) void grade(suggested)
      else if (mode === 'choice' && !flipped && /^[1-9]$/.test(e.key)) pick(Number(e.key) - 1)
      else if (flipped) {
        const g = GRADES.find((x) => x.key === e.key)
        if (g) void grade(g.grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, flipped, termVisible, suggested, check, pick, prev, next, speakTerm, grade])

  const done = doneIds.size
  const total = initialQueue.length

  if (!current || !card) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-10 text-center space-y-3">
        <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
        <p className="font-semibold">{done ? `Xong phiên ôn — ${done} thẻ` : 'Không còn thẻ đến hạn'}</p>
        <p className="text-xs text-muted-foreground">Thẻ sẽ quay lại đúng lúc bạn sắp quên.</p>
        <div className="flex justify-center gap-2 pt-1">
          {history.length > 0 && (
            <Button size="sm" variant="ghost" className="rounded-full gap-1" onClick={prev}>
              <ChevronLeft className="h-3.5 w-3.5" /> Thẻ trước
            </Button>
          )}
          <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => setScope((m) => (m === 'all' ? 'due' : 'all'))}>
            <RotateCcw className="h-3.5 w-3.5" /> {scope === 'all' ? 'Chỉ thẻ đến hạn' : `Ôn tất cả ${set.items.length} thẻ`}
          </Button>
        </div>
      </div>
    )
  }

  const speech = speechOn ? { onSpeak: speakTerm, speaking } : null
  const status = current.reps ? `đã ôn ${current.reps} lần` : 'thẻ mới'
  const meaningOnly = { ...card, example: undefined }
  const tapHint = !flipped && (mode === 'flip' || mode === 'reverse') && <span className="text-[11px] text-muted-foreground pt-2">Chạm hoặc nhấn Space để lật</span>
  const label = cloze
    ? flipped
      ? 'Đáp án'
      : mode === 'type'
        ? 'Gõ phần bị ẩn'
        : mode === 'choice'
          ? 'Chọn phần bị ẩn'
          : 'Điền chỗ trống'
    : mode === 'flip'
      ? flipped
        ? 'Mặt sau'
        : 'Mặt trước'
      : flipped
        ? 'Đáp án'
        : mode === 'type'
          ? 'Gõ từ có nghĩa này'
          : mode === 'choice'
            ? 'Chọn nghĩa đúng'
            : 'Nghĩa này là từ gì?'
  const face = (
    <>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label} · {status}
      </span>
      {card.image && <CardImage src={card.image} />}
      {cloze ? (
        // Điền chỗ trống: câu ẩn đáp án ⇒ (lật) hiện đáp án + ghi chú
        <>
          <TermFace card={card} reveal={flipped} speech={speech} />
          {flipped && (card.back || card.example) && (
            <div className="pt-2 border-t w-full">
              <MeaningFace card={card} />
            </div>
          )}
        </>
      ) : mode === 'flip' || mode === 'choice' ? (
        // Lật thẻ / trắc nghiệm: từ ⇒ (lật) nghĩa + ví dụ
        <>
          <TermFace card={card} size={flipped && mode === 'flip' ? 'sm' : 'lg'} speech={speech} />
          {flipped && (
            <div className="pt-2 border-t w-full">
              <MeaningFace card={card} />
            </div>
          )}
        </>
      ) : (
        // Đảo mặt / gõ: nghĩa ⇒ (lật) nghĩa nhỏ + từ + ví dụ (ví dụ chứa từ ⇒ chỉ hiện sau khi lật)
        <>
          <MeaningFace card={meaningOnly} size={flipped ? 'sm' : 'lg'} />
          {flipped && (
            <div className="pt-2 border-t w-full space-y-1.5">
              <TermFace card={card} speech={speech} />
              {card.example && <MeaningFace card={{ ...card, back: '' }} />}
            </div>
          )}
        </>
      )}
      {tapHint}
    </>
  )

  const actions = flipped ? (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map((g) => (
        <button
          key={g.grade}
          type="button"
          disabled={busy}
          onClick={() => void grade(g.grade)}
          className={cn(
            'rounded-xl border bg-card py-2 text-sm font-semibold transition-colors disabled:opacity-50',
            g.className,
            suggested === g.grade && 'ring-2 ring-current ring-offset-1 ring-offset-background'
          )}
        >
          {g.label}
          <span className="block text-[10px] font-normal text-muted-foreground">
            {g.hint} · {suggested === g.grade ? 'Enter' : g.key}
          </span>
        </button>
      ))}
    </div>
  ) : mode === 'choice' && choices ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {choices.options.map((o, i) => (
        <button
          key={i}
          type="button"
          onClick={() => pick(i)}
          className="flex items-start gap-2 rounded-xl border bg-card px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
          <MarkdownPreview content={o} className="min-w-0 leading-snug [&>p]:m-0" />
        </button>
      ))}
    </div>
  ) : mode === 'type' ? (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        check()
      }}
    >
      <Input
        ref={inputRef}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={cloze ? 'Gõ phần bị ẩn rồi Enter…' : 'Gõ từ rồi Enter…'}
        className="h-10 rounded-xl"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <Button type="submit" variant={typed.trim() ? 'default' : 'outline'} className="h-10 rounded-xl shrink-0">
        {typed.trim() ? 'Kiểm tra' : 'Xem đáp án'}
      </Button>
    </form>
  ) : (
    <Button className="w-full h-10 rounded-xl" onClick={() => setFlipped(true)}>
      Lật thẻ
    </Button>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {scope === 'all' ? 'Ôn tất cả' : 'Thẻ đến hạn'} · {done}/{total}
        </span>
        <div className="flex items-center gap-3">
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
          <ReviewSettings prefs={prefs} onChange={setPrefs} canSpeak={speechOn} />
        </div>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      {/* Thẻ: chạm để lật (chế độ gõ ⇒ chạm để vào ô gõ) */}
      <div
        role="button"
        tabIndex={-1}
        onClick={() => (mode === 'type' && !flipped ? inputRef.current?.focus() : setFlipped((f) => !f))}
        className={cn(
          'w-full min-h-56 rounded-2xl border-2 px-6 py-8 flex flex-col items-center justify-center text-center gap-2 transition-colors bg-card cursor-pointer select-none',
          !flipped && 'border-dashed hover:border-primary/30',
          flipped && correct === null && 'border-primary/40 bg-primary/5',
          flipped && correct === true && 'border-emerald-500/50 bg-emerald-500/5',
          flipped && correct === false && 'border-red-500/40 bg-red-500/5'
        )}
      >
        {flipped && correct !== null && (
          <span className={cn('text-xs font-semibold', correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {correct
              ? 'Chính xác ✓'
              : picked !== null && choices
                ? `Chưa đúng — bạn chọn "${speechText(choices.options[picked])}"`
                : typed.trim()
                  ? `Chưa đúng — bạn gõ "${typed.trim()}"`
                  : 'Đáp án'}
          </span>
        )}
        {face}
      </div>

      <div className="flex items-stretch gap-2">
        <NavButton label="Thẻ trước (←)" disabled={!history.length || busy} onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </NavButton>
        <div className="min-w-0 flex-1">{actions}</div>
        <NavButton label="Bỏ qua, thẻ sau (→)" disabled={queue.length < 2 || busy} onClick={next}>
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>
    </div>
  )
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="outline" disabled={disabled} onClick={onClick} aria-label={label} title={label} className="h-auto min-h-10 w-10 shrink-0 rounded-xl px-0">
      {children}
    </Button>
  )
}

// Cài đặt phiên ôn: cách ôn + tự đọc
function ReviewSettings({ prefs, onChange, canSpeak }: { prefs: Prefs; onChange: (p: Partial<Prefs>) => void; canSpeak: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1 hover:text-foreground" aria-label="Cách ôn">
          <Settings2 className="h-3.5 w-3.5" /> {MODES.find((m) => m.mode === prefs.mode)?.label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 space-y-1">
        <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cách ôn</p>
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => onChange({ mode: m.mode })}
            className={cn('w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted', prefs.mode === m.mode && 'bg-primary/10 text-primary')}
          >
            <span className="font-medium">{m.label}</span>
            <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
          </button>
        ))}
        {canSpeak && (
          <label className="flex items-center justify-between gap-2 rounded-lg px-2 pb-1 pt-2.5 mt-1 border-t text-sm cursor-pointer">
            <span>
              Tự đọc từ
              <span className="block text-[11px] text-muted-foreground">Đọc khi mặt từ hiện ra</span>
            </span>
            <Switch checked={prefs.autoSpeak} onCheckedChange={(v: boolean) => onChange({ autoSpeak: v })} />
          </label>
        )}
      </PopoverContent>
    </Popover>
  )
}
