'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BadgeCheck, Check, ChevronDown, Download, Loader2, Pencil, Pin, PinOff, Plus, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { AI_SKILL_LIMIT, AiSkillDraftInputSchema, AiSkillInputSchema, type AiSkillInput } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAiSkill, useAiSkillActions, useAiSkills, useSkillLibrary, useSkillState } from '@/hooks/chat'
import { SKILL_FILE_ACCEPT, SKILL_FILE_MAX_BYTES, parseSkillFile, toSlug } from '@/lib/skill-file'
import { cn } from '@/lib/utils'

// Bản nháp chưa lưu: do N7AI viết hoặc đọc từ tệp ⇒ mở form để xem lại
type Draft = { input: AiSkillInput; source: 'ai' | 'file' }
type View = { mode: 'list' } | { mode: 'library' } | { mode: 'ai' } | { mode: 'edit'; id: string | null; draft?: Draft }
const TITLE = { list: 'Của bạn', library: 'Thư viện' }

const EMPTY: AiSkillInput = { slug: '', name: '', description: '', instructions: '', inputHint: '', isPublic: false }
const AI_EXAMPLES = ['Chấm bài luận IELTS', 'Giải thích thuật toán kèm code Python', 'Lập kế hoạch học 1 tuần']

// Hộp thoại quản lý skill (mở từ "+" / "/" trong ô soạn tin)
export function SkillsDialog({ open, onOpenChange, startWithCreate }: { open: boolean; onOpenChange: (v: boolean) => void; startWithCreate?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5 gap-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> Skill N7AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Chỉ dẫn lưu sẵn, gọi nhanh bằng <code>/lệnh</code>.
          </DialogDescription>
        </DialogHeader>
        {open && <SkillsManager startWithCreate={startWithCreate} />}
      </DialogContent>
    </Dialog>
  )
}

// Quản lý skill: tab Của bạn / Thư viện ⇄ tạo (tự viết / tệp / N7AI) / sửa — dùng ở hộp thoại & trang Cài đặt
export function SkillsManager({ startWithCreate }: { startWithCreate?: boolean }) {
  const [view, setView] = useState<View>(startWithCreate ? { mode: 'ai' } : { mode: 'list' })
  // Giữ mô tả đã gõ để "Viết lại" không mất
  const [aiPrompt, setAiPrompt] = useState('')
  const toList = () => setView({ mode: 'list' })

  if (view.mode === 'ai' || view.mode === 'edit') {
    const title = view.mode === 'ai' ? 'Tạo với N7AI' : view.id ? 'Sửa skill' : 'Tạo skill'
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={toList}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {title}
        </button>
        {view.mode === 'ai' ? (
          <SkillDraftStep
            prompt={aiPrompt}
            setPrompt={setAiPrompt}
            onDraft={(input) => setView({ mode: 'edit', id: null, draft: { input, source: 'ai' } })}
            onManual={() => setView({ mode: 'edit', id: null })}
          />
        ) : (
          <SkillForm key={view.id ?? 'new'} id={view.id} draft={view.draft} onRedo={() => setView({ mode: 'ai' })} onDone={toList} />
        )}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-xs font-medium">
        {(['list', 'library'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setView({ mode: m })}
            className={cn('h-7 rounded-full cursor-pointer', view.mode === m ? 'bg-background shadow-xs' : 'text-muted-foreground')}
          >
            {TITLE[m]}
          </button>
        ))}
      </div>
      {view.mode === 'list' ? (
        <SkillList
          onEdit={(id) => setView({ mode: 'edit', id })}
          onCreate={(draft) => setView({ mode: 'edit', id: null, draft })}
          onAi={() => setView({ mode: 'ai' })}
          onLibrary={() => setView({ mode: 'library' })}
        />
      ) : (
        <SkillLibrary />
      )}
    </div>
  )
}

interface SkillListProps {
  onEdit: (id: string) => void
  onCreate: (draft?: Draft) => void
  onAi: () => void
  onLibrary: () => void
}

function SkillList({ onEdit, onCreate, onAi, onLibrary }: SkillListProps) {
  const { data: skills, isPending } = useAiSkills()
  const { remove } = useAiSkillActions()
  const state = useSkillState()
  if (isPending) return <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
  return (
    <div className="space-y-2">
      {skills?.length ? (
        <ul className="divide-y divide-border/60 rounded-xl border">
          {skills.map((s) => (
            <li key={s.id} className={cn('flex items-center gap-2 px-3 py-2', !s.enabled && 'opacity-60')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {s.pinned && <Pin className="mr-1 inline h-3 w-3 text-primary" />}
                  {s.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  /{s.slug}
                  {s.useCount > 0 && ` · đã dùng ${s.useCount} lần`}
                  {s.isPublic && ` · công khai, ${s.installCount} lượt cài`}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                className={cn('h-7 w-7 rounded-full', s.pinned && 'text-primary')}
                onClick={() => state.mutate({ id: s.id, pinned: !s.pinned })}
                aria-label={s.pinned ? `Bỏ ghim ${s.name}` : `Ghim ${s.name} lên đầu menu /`}
                title={s.pinned ? 'Bỏ ghim' : 'Ghim lên đầu menu /'}
              >
                {s.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </Button>
              <Switch
                checked={s.enabled}
                onCheckedChange={(enabled) => state.mutate({ id: s.id, enabled })}
                aria-label={s.enabled ? `Tắt ${s.name}` : `Bật ${s.name}`}
                title={s.enabled ? 'Đang bật — hiện trong menu /' : 'Đã tắt — ẩn khỏi menu /'}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => onEdit(s.id)} aria-label={`Sửa ${s.name}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full text-destructive"
                disabled={remove.isPending}
                onClick={() => window.confirm(`Xóa skill "${s.name}"?`) && remove.mutate(s.id)}
                aria-label={`Xóa ${s.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          Chưa có skill nào.{' '}
          <button type="button" onClick={onLibrary} className="font-medium text-primary hover:underline cursor-pointer">
            Xem thư viện
          </button>
        </p>
      )}
      <CreateMenu disabled={(skills?.length ?? 0) >= AI_SKILL_LIMIT} onManual={() => onCreate()} onFile={(input) => onCreate({ input, source: 'file' })} onAi={onAi} />
    </div>
  )
}

// Nút "Tạo skill": tự viết / tải tệp .md / nhờ N7AI viết
function CreateMenu({ disabled, onManual, onFile, onAi }: { disabled: boolean; onManual: () => void; onFile: (input: AiSkillInput) => void; onAi: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > SKILL_FILE_MAX_BYTES) return toast.error('Tệp tối đa 64 KB')
    onFile(parseSkillFile(await file.text(), file.name))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="w-full rounded-full gap-1.5" disabled={disabled}>
            <Plus className="h-3.5 w-3.5" /> Tạo skill <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          <DropdownMenuItem onSelect={onAi}>
            <Sparkles className="h-4 w-4 text-primary" /> Tạo với N7AI
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onManual}>
            <Pencil className="h-4 w-4" /> Tự viết
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Tải lên tệp .md
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={fileRef} type="file" accept={SKILL_FILE_ACCEPT} className="hidden" onChange={pick} />
    </>
  )
}

// Tạo với N7AI: mô tả ngắn ⇒ bản nháp ⇒ xem lại ở form
function SkillDraftStep({
  prompt,
  setPrompt,
  onDraft,
  onManual
}: {
  prompt: string
  setPrompt: (v: string) => void
  onDraft: (input: AiSkillInput) => void
  onManual: () => void
}) {
  const { draft } = useAiSkillActions()
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = AiSkillDraftInputSchema.safeParse({ prompt })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Mô tả chưa hợp lệ')
    setError(null)
    draft.mutate(parsed.data.prompt, { onSuccess: (d) => onDraft({ ...d, inputHint: d.inputHint ?? '', isPublic: false }) })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        autoFocus
        rows={4}
        maxLength={1000}
        value={prompt}
        disabled={draft.isPending}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Bạn muốn N7AI làm gì? VD: chấm bài luận tiếng Anh theo tiêu chí IELTS, chỉ ra lỗi và gợi ý sửa"
      />
      <div className="flex flex-wrap gap-1.5">
        {AI_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={draft.isPending}
            onClick={() => setPrompt(ex)}
            className="h-7 rounded-full bg-muted px-3 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {ex}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" className="w-full rounded-full gap-1.5" disabled={draft.isPending}>
        {draft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {draft.isPending ? 'N7AI đang viết…' : 'Viết bản nháp'}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Tốn 1 lượt · xem lại trước khi lưu ·{' '}
        <button type="button" onClick={onManual} className="font-medium text-primary hover:underline cursor-pointer">
          Tự viết
        </button>
      </p>
    </form>
  )
}

function SkillForm({ id, draft, onRedo, onDone }: { id: string | null; draft?: Draft; onRedo: () => void; onDone: () => void }) {
  const { data: detail, isPending } = useAiSkill(id)
  const { create, update } = useAiSkillActions()
  const [form, setForm] = useState<AiSkillInput>(draft?.input ?? EMPTY)
  const [slugEdited, setSlugEdited] = useState(!!draft)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (detail) {
      setForm({
        slug: detail.slug,
        name: detail.name,
        description: detail.description,
        instructions: detail.instructions,
        inputHint: detail.inputHint ?? '',
        isPublic: detail.isPublic
      })
      setSlugEdited(true)
    }
  }, [detail])

  const set = <K extends keyof AiSkillInput>(key: K, value: AiSkillInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const saving = create.isPending || update.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = AiSkillInputSchema.safeParse(form)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ')
    setError(null)
    const body = { ...parsed.data, inputHint: parsed.data.inputHint || null }
    if (id) update.mutate({ id, body }, { onSuccess: onDone })
    else create.mutate(body, { onSuccess: onDone })
  }

  if (id && isPending) return <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
  return (
    <form onSubmit={submit} className="space-y-3">
      {draft && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs">
          {draft.source === 'ai' ? <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="min-w-0 flex-1 text-muted-foreground">{draft.source === 'ai' ? 'Bản nháp từ N7AI — xem lại rồi lưu' : 'Đọc từ tệp — xem lại rồi lưu'}</span>
          {draft.source === 'ai' && (
            <button type="button" onClick={onRedo} className="shrink-0 font-medium text-primary hover:underline cursor-pointer">
              Viết lại
            </button>
          )}
        </div>
      )}
      <Field label="Tên">
        <Input
          value={form.name}
          maxLength={60}
          placeholder="Giải bài kiểu gợi mở"
          onChange={(e) => {
            set('name', e.target.value)
            if (!slugEdited) set('slug', toSlug(e.target.value))
          }}
        />
      </Field>
      <Field label="Lệnh">
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">/</span>
          <Input
            value={form.slug}
            maxLength={40}
            placeholder="goi-mo"
            onChange={(e) => {
              setSlugEdited(true)
              set('slug', e.target.value.toLowerCase())
            }}
          />
        </div>
      </Field>
      <Field label="Mô tả ngắn (tùy chọn)">
        <Input value={form.description} maxLength={200} placeholder="Gợi ý từng bước, không đưa đáp án" onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Field label="Chỉ dẫn cho N7AI">
        <Textarea
          value={form.instructions}
          maxLength={4000}
          rows={6}
          placeholder="Ví dụ: Đặt câu hỏi gợi mở trước, chỉ đưa lời giải khi mình yêu cầu. Cuối câu trả lời tóm tắt 3 ý chính."
          onChange={(e) => set('instructions', e.target.value)}
        />
      </Field>
      <Field label="Gợi ý nhập (tùy chọn)">
        <Input value={form.inputHint ?? ''} maxLength={150} placeholder="Dán đề bài cần gợi ý…" onChange={(e) => set('inputHint', e.target.value)} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2">
        <span>
          <span className="block text-xs font-medium">Chia sẻ lên thư viện</span>
          <span className="block text-[11px] text-muted-foreground">Người khác thấy tên, mô tả và cài được bản sao chỉ dẫn</span>
        </span>
        <Switch checked={form.isPublic} onCheckedChange={(v) => set('isPublic', v)} />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" className="w-full rounded-full" disabled={saving}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {id ? 'Lưu thay đổi' : 'Tạo skill'}
      </Button>
    </form>
  )
}

// Thư viện: skill công khai của người khác, tìm ở server (debounce), cài = sao chép về của mình
function SkillLibrary() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])
  const { data, isPending } = useSkillLibrary(q)
  const { install } = useAiSkillActions()

  return (
    <div className="space-y-2">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm skill (vd. ôn thi, code review)…" />
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
      ) : data?.length ? (
        <ul className="divide-y divide-border/60 rounded-xl border">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium">
                  <span className="truncate">{s.name}</span>
                  {s.official && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Chính thức" />}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  /{s.slug} · {s.official ? 'N7AI' : s.author.displayName} · {s.installCount} lượt cài
                </span>
                {s.description && <span className="block truncate text-[11px] text-muted-foreground">{s.description}</span>}
              </span>
              <Button
                size="sm"
                variant={s.installed ? 'secondary' : 'outline'}
                className="h-7 rounded-full text-xs gap-1"
                disabled={s.installed || install.isPending}
                onClick={() => install.mutate(s.id)}
              >
                {s.installed ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Đã cài
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Cài
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">{q ? 'Không tìm thấy skill' : 'Chưa có skill công khai nào'}</p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
