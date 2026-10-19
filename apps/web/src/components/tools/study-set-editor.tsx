'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Braces, ClipboardPaste, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  FLASHCARD_TEMPLATES,
  SPEECH_LANGS,
  STUDY_SET_MAX_ITEMS,
  type FlashcardTemplate,
  type SpeechLang,
  type StudyItemContent,
  type StudySetDetail,
  type StudySetOptions,
  type StudyToolKind
} from '@pu/schemas'
import { N7AiMark } from '@/components/brand/pu-logo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useStudySetActions } from '@/hooks/use-study-tools'
import { errorMessage, uploadFileToR2 } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { SPEECH_LANG_LABELS } from './card-speech'
import { FLASHCARD_TEMPLATE_META, TOOL_META, asCard, asQuestion, emptyContent, parseCardLines } from './tool-catalog'

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
  const [options, setOptions] = useState<StudySetOptions>({})
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
    setOptions(init?.options ?? {})
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
          // Bộ chưa chọn mẫu ⇒ theo gợi ý của N7AI (vd. từ vựng tiếng Anh)
          if (!options.template && d.options) setOptions((o) => ({ ...d.options, ...o }))
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
    const body = { kind, title: title.trim(), description: description.trim() || null, options: kind === 'flashcards' ? options : {}, items }
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
            {kind === 'flashcards' && <DeckOptions options={options} onChange={setOptions} />}
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
                placeholder={'Mỗi dòng 1 thẻ, vd.\nInvisible (adj) - Vô hình\nPhysicist: Nhà vật lý học\nOrbit (n) | /ˈɔː.bɪt/ | Quỹ đạo | The moon orbits the Earth.\nThủ đô của Pháp là {{Paris}}'}
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
              {kind === 'flashcards' ? (
                <CardFields content={r.content} template={options.template ?? 'basic'} onChange={(c) => setContent(r.key, c)} />
              ) : ( <QuestionFields content={r.content} onChange={(c) => setContent(r.key, c)} />
              )}
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

// Mẫu bộ + ngôn ngữ phát âm (chỉ flashcard)
function DeckOptions({ options, onChange }: { options: StudySetOptions; onChange: (o: StudySetOptions) => void }) {
  const template = options.template ?? 'basic'
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="inline-flex rounded-full border p-0.5" role="radiogroup" aria-label="Mẫu bộ">
        {FLASHCARD_TEMPLATES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={template === t}
            title={FLASHCARD_TEMPLATE_META[t].hint}
            onClick={() => onChange({ ...options, template: t })}
            className={cn('rounded-full px-2.5 py-1 font-medium transition-colors', template === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {FLASHCARD_TEMPLATE_META[t].label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-muted-foreground">
        Phát âm
        <select
          value={options.lang ?? ''}
          onChange={(e) => onChange({ ...options, lang: (e.target.value || undefined) as SpeechLang | undefined })}
          className="h-7 rounded-full border bg-background px-2 text-xs text-foreground"
        >
          <option value="">{template === 'vocab' ? 'Tự nhận' : 'Tắt'}</option>
          {SPEECH_LANGS.map((l) => (
            <option key={l} value={l}>
              {SPEECH_LANG_LABELS[l]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

const FIELD_HINTS: Record<FlashcardTemplate, { front: string; back: string }> = {
  basic: { front: 'Mặt trước', back: 'Mặt sau' },
  vocab: { front: 'Từ, vd. Orbit (n)', back: 'Nghĩa' },
  cloze: { front: 'Câu có chỗ trống, vd. Thủ đô của Pháp là {{Paris}}', back: 'Ghi chú (không bắt buộc)' }
}

// Thẻ: mặt trước / sau; phiên âm + ví dụ + ảnh luôn hiện ở mẫu Từ vựng, mẫu khác mở bằng "+ Chi tiết"
// Mẫu Điền chỗ trống: bôi đen chữ trong mặt trước ⇒ nút {{ }} bọc thành chỗ trống
function CardFields({ content, template, onChange }: { content: StudyItemContent; template: FlashcardTemplate; onChange: (c: StudyItemContent) => void }) {
  const c = asCard(content)
  const vocab = template === 'vocab'
  const [more, setMore] = useState(() => !!(c.phonetic || c.example || c.image))
  const frontRef = useRef<HTMLTextAreaElement>(null)
  const showMore = vocab || more
  const hints = FIELD_HINTS[template]
  // Ô trống ⇒ bỏ trường (không lưu chuỗi rỗng)
  const set = (field: 'phonetic' | 'example' | 'image', v: string) => onChange({ ...c, [field]: v || undefined })
  const wrapCloze = () => {
    const el = frontRef.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    const picked = c.front.slice(a, b).trim()
    if (!picked) return toast.info('Bôi đen phần cần ẩn trong mặt trước rồi bấm {{ }}')
    onChange({ ...c, front: `${c.front.slice(0, a)}{{${picked}}}${c.front.slice(b)}` })
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Textarea
            ref={frontRef}
            value={c.front}
            onChange={(e) => onChange({ ...c, front: e.target.value })}
            rows={2}
            maxLength={500}
            placeholder={hints.front}
            className={cn('text-sm min-h-0', template === 'cloze' && 'pr-9')}
          />
          {template === 'cloze' && (
            <button
              type="button"
              // Giữ vùng bôi đen của ô mặt trước khi bấm
              onMouseDown={(e) => e.preventDefault()}
              onClick={wrapCloze}
              className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
              aria-label="Tạo chỗ trống từ phần đang bôi đen"
              title="Tạo chỗ trống từ phần đang bôi đen"
            >
              <Braces className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Textarea value={c.back} onChange={(e) => onChange({ ...c, back: e.target.value })} rows={2} maxLength={2000} placeholder={hints.back} className="text-sm min-h-0" />
      </div>
      {showMore ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <CardImageField value={c.image} onChange={(url) => set('image', url ?? '')} />
          <div className="grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2 content-start">
            <Input value={c.phonetic ?? ''} onChange={(e) => set('phonetic', e.target.value)} maxLength={120} placeholder="Phiên âm, vd. /ˈɔː.bɪt/" className="h-8 text-xs font-mono" />
            <Input value={c.example ?? ''} onChange={(e) => set('example', e.target.value)} maxLength={600} placeholder="Câu ví dụ (không bắt buộc)" className="h-8 text-xs" />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="text-[11px] text-primary hover:underline">
          + Chi tiết (ảnh, phiên âm, ví dụ)
        </button>
      )}
    </div>
  )
}

const IMAGE_MAX_MB = 5

// Ảnh minh họa thẻ: tải lên R2 (thư mục ảnh bài viết) ⇒ lưu link; khung cố định 64px
function CardImageField({ value, onChange }: { value?: string; onChange: (url: string | undefined) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Chỉ nhận tệp ảnh')
    if (file.size > IMAGE_MAX_MB * 1024 * 1024) return toast.error(`Ảnh tối đa ${IMAGE_MAX_MB} MB`)
    setUploading(true)
    try {
      onChange((await uploadFileToR2(file, 'posts/images')).url)
    } catch (err) {
      toast.error(errorMessage(err, 'Không tải được ảnh lên'))
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="relative h-16 w-16 shrink-0">
      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh R2 người dùng tải lên */}
          <img src={value} alt="" className="h-16 w-16 rounded-lg border object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-destructive"
            aria-label="Bỏ ảnh"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Ảnh
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
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
