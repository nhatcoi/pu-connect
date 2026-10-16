'use client'

import React, { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import { AI_SKILL_LIMIT, AiSkillInputSchema, type AiSkillInput } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAiSkill, useAiSkillActions, useAiSkills } from '@/hooks/chat'

type View = { mode: 'list' } | { mode: 'edit'; id: string | null }

const EMPTY: AiSkillInput = { slug: '', name: '', description: '', instructions: '', inputHint: '' }

// Tên → lệnh gợi ý: bỏ dấu, chữ thường, gạch ngang
const toSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

// Quản lý skill tự tạo: danh sách ⇄ form tạo / sửa (chỉ dẫn tải khi mở form)
export function SkillsDialog({ open, onOpenChange, startWithCreate }: { open: boolean; onOpenChange: (v: boolean) => void; startWithCreate?: boolean }) {
  const [view, setView] = useState<View>({ mode: 'list' })
  useEffect(() => {
    if (open) setView(startWithCreate ? { mode: 'edit', id: null } : { mode: 'list' })
  }, [open, startWithCreate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5 gap-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {view.mode === 'edit' && (
              <button
                type="button"
                onClick={() => setView({ mode: 'list' })}
                aria-label="Quay lại"
                className="p-1 -ml-1 rounded-full hover:bg-muted cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Wand2 className="h-4 w-4 text-primary" /> {view.mode === 'list' ? 'Skill của bạn' : view.id ? 'Sửa skill' : 'Tạo skill'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Lưu chỉ dẫn hay dùng thành lệnh <code>/tên-lệnh</code> cho PU AI (ví dụ: chấm bài theo rubric, giải thích kiểu Feynman). Chỉ bạn thấy và dùng được.
          </DialogDescription>
        </DialogHeader>
        {view.mode === 'list' ? (
          <SkillList onEdit={(id) => setView({ mode: 'edit', id })} />
        ) : (
          <SkillForm id={view.id} onDone={() => setView({ mode: 'list' })} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SkillList({ onEdit }: { onEdit: (id: string | null) => void }) {
  const { data: skills, isPending } = useAiSkills()
  const { remove } = useAiSkillActions()
  if (isPending) return <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
  return (
    <div className="space-y-2">
      {skills?.length ? (
        <ul className="divide-y divide-border/60 rounded-xl border">
          {skills.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  /{s.slug}
                  {s.useCount > 0 && ` · đã dùng ${s.useCount} lần`}
                </span>
              </span>
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
        <p className="text-xs text-muted-foreground text-center py-4">Chưa có skill nào.</p>
      )}
      <Button size="sm" className="w-full rounded-full gap-1.5" disabled={(skills?.length ?? 0) >= AI_SKILL_LIMIT} onClick={() => onEdit(null)}>
        <Plus className="h-3.5 w-3.5" /> Tạo skill
      </Button>
    </div>
  )
}

function SkillForm({ id, onDone }: { id: string | null; onDone: () => void }) {
  const { data: detail, isPending } = useAiSkill(id)
  const { create, update } = useAiSkillActions()
  const [form, setForm] = useState<AiSkillInput>(EMPTY)
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (detail) {
      setForm({ slug: detail.slug, name: detail.name, description: detail.description, instructions: detail.instructions, inputHint: detail.inputHint ?? '' })
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
      <Field label="Chỉ dẫn cho PU AI">
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
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" className="w-full rounded-full" disabled={saving}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {id ? 'Lưu thay đổi' : 'Tạo skill'}
      </Button>
    </form>
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
