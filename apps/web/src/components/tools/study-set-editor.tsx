'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { STUDY_SET_MAX_ITEMS, type StudyItemContent, type StudySetDetail, type StudyToolKind } from '@pu/schemas'
import { N7AiMark } from '@/components/brand/pu-logo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useStudySetActions } from '@/hooks/use-study-tools'
import { cn } from '@/lib/utils'
import { TOOL_META, asCard, asQuestion, emptyContent, parseCardLines } from './tool-catalog'

type Row = { key: string; id?: string; content: StudyItemContent }
type Panel = 'ai' | 'paste' | null

let seq = 0
const row = (content: StudyItemContent, id?: string): Row => ({ key: `r${++seq}`, id, content })

// Soạn bộ Flashcard / Quiz: tự nhập · dán danh sách · N7AI tạo nháp (xem lại rồi lưu)
export function StudySetEditor({
  open,
  onOpenChange,
  kind,
  initial,
  startWithAi = false,
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: StudyToolKind
  initial?: StudySetDetail | null
  startWithAi?: boolean
  onSaved?: (set: StudySetDetail) => void
}) {
  const meta = TOOL_META[kind]
  const { create, update, draft } = useStudySetActions()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [panel, setPanel] = useState<Panel>(null)
  const [prompt, setPrompt] = useState('')
  const [paste, setPaste] = useState('')
  const listEnd = useRef<HTMLDivElement>(null)

  // Nạp dữ liệu khi vừa mở / Snapshot on open
  const initialRef = useRef(initial)
  initialRef.current = initial
  useEffect(() => {
    if (!open) return
    const init = initialRef.current
    setTitle(init?.title ?? '')
    setDescription(init?.description ?? '')
    setRows(init?.items.length ? init.items.map((it) => row(it.content, it.id)) : startWithAi ? [] : [row(emptyContent(kind))])
    setPanel(!init && startWithAi ? 'ai' : null)
    setPrompt('')
    setPaste('')
  }, [open, kind, startWithAi])

  const setContent = (key: string, content: StudyItemContent) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, content } : r)))
  const addRows = (contents: StudyItemContent[]) => {
    setRows((rs) => {
      // Bỏ dòng trống mặc định khi thêm hàng loạt
      const kept = rs.filter((r) => !isBlank(r.content))
      return [...kept, ...contents.map((c) => row(c))].slice(0, STUDY_SET_MAX_ITEMS)
    })
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
  }

  const runDraft = () => {
    if (prompt.trim().length < 3) return
    draft.mutate(
      { kind, prompt: prompt.trim() },
      {
        onSuccess: (d) => {
          if (!title.trim()) setTitle(d.title)
          if (!description.trim() && d.description) setDescription(d.description)
          addRows(d.items.map((it) => it.content))
          setPanel(null)
          toast.success(`N7AI đã tạo ${d.items.length} ${meta.itemLabel} — xem lại rồi lưu`)
        }
      }
    )
  }

  const runPaste = () => {
    const cards = parseCardLines(paste)
    if (!cards.length) return toast.error('Không đọc được dòng nào. Mỗi dòng: mặt trước - mặt sau')
    addRows(cards)
    setPaste('')
    setPanel(null)
  }

  const save = () => {
    const items = rows.filter((r) => !isBlank(r.content)).map((r) => ({ id: r.id, content: r.content }))
    if (!title.trim()) return toast.error('Nhập tên bộ')
    if (!items.length) return toast.error(`Thêm ít nhất 1 ${meta.itemLabel}`)
    const body = { kind, title: title.trim(), description: description.trim() || null, items }
    const done = (set: StudySetDetail) => {
      toast.success(initial ? 'Đã lưu thay đổi' : `Đã tạo bộ ${meta.label}`)
      onOpenChange(false)
      onSaved?.(set)
    }
    if (initial) update.mutate({ id: initial.id, body }, { onSuccess: done })
    else create.mutate(body, { onSuccess: done })
  }

  const saving = create.isPending || update.isPending
  const count = rows.filter((r) => !isBlank(r.content)).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">{initial ? `Sửa bộ ${meta.label}` : `Bộ ${meta.label} mới`}</DialogTitle>
          <div className="space-y-2 pt-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Tên bộ, vd. Từ vựng Khoa học & Vũ trụ" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Mô tả ngắn (không bắt buộc)" className="h-8 text-xs" />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <Button size="sm" variant={panel === 'ai' ? 'secondary' : 'outline'} className="h-7 rounded-full text-xs gap-1" onClick={() => setPanel(panel === 'ai' ? null : 'ai')}>
              <N7AiMark className="h-3.5 w-3.5" /> Tạo bằng N7AI
            </Button>
            {kind === 'flashcards' && (
              <Button size="sm" variant={panel === 'paste' ? 'secondary' : 'outline'} className="h-7 rounded-full text-xs gap-1" onClick={() => setPanel(panel === 'paste' ? null : 'paste')}>
                <ClipboardPaste className="h-3.5 w-3.5" /> Dán danh sách
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs gap-1" onClick={() => addRows([emptyContent(kind)])}>
              <Plus className="h-3.5 w-3.5" /> Thêm {meta.itemLabel}
            </Button>
          </div>
          {panel === 'ai' && (
            <div className="mt-2 space-y-2 rounded-xl border bg-primary/5 p-3">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={8000} placeholder={meta.aiHint} className="text-sm bg-background" autoFocus />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Tốn 1 lượt N7AI · thêm vào cuối bộ</span>
                <Button size="sm" className="h-7 rounded-full text-xs gap-1" disabled={draft.isPending || prompt.trim().length < 3} onClick={runDraft}>
                  {draft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Tạo
                </Button>
              </div>
            </div>
          )}
          {panel === 'paste' && (
            <div className="mt-2 space-y-2 rounded-xl border bg-muted/40 p-3">
              <Textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={5}
                placeholder={'Mỗi dòng 1 thẻ, vd.\nInvisible (adj) - Vô hình\nPhysicist: Nhà vật lý học'}
                className="text-sm bg-background font-mono"
                autoFocus
              />
              <div className="flex justify-end">
                <Button size="sm" className="h-7 rounded-full text-xs" disabled={!paste.trim()} onClick={runPaste}>
                  Thêm {parseCardLines(paste).length || ''} thẻ
                </Button>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
          {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có {meta.itemLabel} nào.</p>}
          {rows.map((r, i) => (
            <div key={r.key} className="group rounded-xl border bg-card p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {meta.itemLabel[0].toUpperCase() + meta.itemLabel.slice(1)} {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                  aria-label={`Xóa ${meta.itemLabel} ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {kind === 'flashcards' ? <CardFields content={r.content} onChange={(c) => setContent(r.key, c)} /> : <QuestionFields content={r.content} onChange={(c) => setContent(r.key, c)} />}
            </div>
          ))}
          <div ref={listEnd} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {count}/{STUDY_SET_MAX_ITEMS} {meta.itemLabel}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button size="sm" disabled={saving} onClick={save} className="gap-1">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Lưu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function isBlank(c: StudyItemContent) {
  if ('front' in c) return !c.front.trim() && !c.back.trim()
  return !c.q.trim() && c.options.every((o) => !o.trim())
}

function CardFields({ content, onChange }: { content: StudyItemContent; onChange: (c: StudyItemContent) => void }) {
  const c = asCard(content)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Textarea value={c.front} onChange={(e) => onChange({ ...c, front: e.target.value })} rows={2} maxLength={500} placeholder="Mặt trước" className="text-sm min-h-0" />
      <Textarea value={c.back} onChange={(e) => onChange({ ...c, back: e.target.value })} rows={2} maxLength={2000} placeholder="Mặt sau" className="text-sm min-h-0" />
    </div>
  )
}

function QuestionFields({ content, onChange }: { content: StudyItemContent; onChange: (c: StudyItemContent) => void }) {
  const q = asQuestion(content)
  const setOption = (i: number, v: string) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? v : o)) })
  const removeOption = (i: number) =>
    onChange({ ...q, options: q.options.filter((_, j) => j !== i), answer: q.answer === i ? 0 : q.answer > i ? q.answer - 1 : q.answer })
  return (
    <div className="space-y-1.5">
      <Textarea value={q.q} onChange={(e) => onChange({ ...q, q: e.target.value })} rows={2} maxLength={1000} placeholder="Câu hỏi" className="text-sm min-h-0" />
      {q.options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...q, answer: i })}
            className={cn(
              'h-6 w-6 shrink-0 rounded-full border text-[11px] font-semibold',
              q.answer === i ? 'border-emerald-500 bg-emerald-500 text-white' : 'text-muted-foreground hover:border-foreground/40'
            )}
            aria-label={`Đặt lựa chọn ${String.fromCharCode(65 + i)} là đáp án đúng`}
            title="Đáp án đúng"
          >
            {String.fromCharCode(65 + i)}
          </button>
          <Input value={o} onChange={(e) => setOption(i, e.target.value)} maxLength={300} placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`} className="h-8 text-sm" />
          {q.options.length > 2 && (
            <button type="button" onClick={() => removeOption(i)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Xóa lựa chọn">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        {q.options.length < 6 && (
          <button type="button" onClick={() => onChange({ ...q, options: [...q.options, ''] })} className="text-[11px] text-primary hover:underline">
            + Lựa chọn
          </button>
        )}
        <Input value={q.explain ?? ''} onChange={(e) => onChange({ ...q, explain: e.target.value })} maxLength={1000} placeholder="Giải thích (không bắt buộc)" className="h-7 text-xs" />
      </div>
    </div>
  )
}
