'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Loader2, Search, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api-client'
import { foldText } from '@/lib/fold-text'
import { cn } from '@/lib/utils'

// Hộp chọn dùng chung cho mọi dữ liệu "có đề xuất" (trường, lĩnh vực, môn học…):
//   danh sách A–Z + ô tìm + dòng "Khác" ghim trên cùng ⇒ form đề xuất ⇒ admin duyệt (mục Đề xuất bên admin).
// Quy tắc: docs/core/03-profile-and-academic-graph.md, mục "Dữ liệu có đề xuất".

export interface PickerOption {
  id: string
  name: string
  hint?: string // chữ phụ, vd. mã môn; cũng được tìm theo
}

export interface SuggestField {
  key: string
  label: string
  type?: 'text' | 'select'
  required?: boolean
  placeholder?: string
  maxLength?: number
  options?: { value: string; label: string }[]
}

export interface SuggestHistoryItem {
  id: string
  name: string
  status: 'pending' | 'approved' | 'rejected'
  note?: string | null // lý do từ chối
}

export interface SuggestConfig {
  noun: string // "môn học", "trường", "lĩnh vực" — dùng trong chữ hướng dẫn
  fields: SuggestField[] // trường đầu tiên là tên đề xuất, điền sẵn từ ô tìm
  onSubmit: (values: Record<string, string>) => Promise<unknown> | unknown
  hint?: string
  successMessage?: string
  history?: SuggestHistoryItem[]
}

// Chọn nhiều: bấm để bật / tắt, không đóng hộp; `reserved` = số chỗ đã bị chiếm bởi mục "Khác" đang chờ duyệt
export interface MultiConfig {
  max: number
  values: string[]
  onChange: (ids: string[]) => void
  reserved?: number
}

interface SuggestPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: PickerOption[]
  value?: string | null
  onSelect?: (id: string | null) => void // bỏ qua ⇒ hộp chỉ để đề xuất
  multi?: MultiConfig // có ⇒ chọn nhiều (bỏ qua value / onSelect / clearLabel)
  clearLabel?: string // có ⇒ thêm dòng bỏ chọn
  suggest?: SuggestConfig
  startInSuggest?: boolean
}

const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối' } as const
const INPUT = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary'

const letterOf = (name: string) => {
  const c = foldText(name).trim().charAt(0).toUpperCase()
  return c >= 'A' && c <= 'Z' ? c : '#'
}

export function SuggestPickerDialog({ open, onOpenChange, title, options, value, onSelect, multi, clearLabel, suggest, startInSuggest }: SuggestPickerProps) {
  const [q, setQ] = useState('')
  const [view, setView] = useState<'list' | 'suggest'>('list')
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  // Mỗi lần mở: về danh sách (hoặc form nếu chỉ để đề xuất), xóa ô tìm. Không phụ thuộc object `suggest` (đổi mỗi lần render)
  const canSuggest = !!suggest
  useEffect(() => {
    if (!open) return
    setQ('')
    setValues({})
    setView(startInSuggest && canSuggest ? 'suggest' : 'list')
  }, [open, startInSuggest, canSuggest])

  // A–Z theo tên (locale vi) rồi nhóm theo chữ cái đầu đã bỏ dấu
  const groups = useMemo(() => {
    const needle = foldText(q.trim())
    const rows = options
      .filter((o) => !needle || foldText(`${o.name} ${o.hint ?? ''}`).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    const map = new Map<string, PickerOption[]>()
    for (const o of rows) {
      const k = letterOf(o.name)
      map.set(k, [...(map.get(k) ?? []), o])
    }
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
  }, [options, q])
  const total = groups.reduce((n, [, rows]) => n + rows.length, 0)

  const used = multi ? multi.values.length + (multi.reserved ?? 0) : 0
  const full = !!multi && used >= multi.max

  const pick = (id: string | null) => {
    if (multi && id) {
      const on = multi.values.includes(id)
      if (!on && full) return
      multi.onChange(on ? multi.values.filter((v) => v !== id) : [...multi.values, id])
      return
    }
    onSelect?.(id)
    onOpenChange(false)
  }

  const openSuggest = () => {
    // Điền sẵn tên từ chữ đang tìm
    if (suggest) setValues({ [suggest.fields[0].key]: q.trim() })
    setView('suggest')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!suggest) return
    setBusy(true)
    try {
      await suggest.onSubmit(values)
      toast.success(suggest.successMessage ?? 'Đã gửi đề xuất, admin sẽ xem xét')
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Không gửi được đề xuất'))
    } finally {
      setBusy(false)
    }
  }

  const missing = suggest?.fields.some((f) => f.required && !(values[f.key] ?? '').trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 p-5">
        {view === 'list' || !suggest ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">{title}</DialogTitle>
              <DialogDescription className="sr-only">Chọn một mục trong danh sách hoặc đề xuất mục mới</DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm…" className={cn(INPUT, 'pl-9')} />
            </div>
            <div className="-mx-1 max-h-[52vh] overflow-y-auto px-1">
              {suggest && (
                <button
                  type="button"
                  disabled={full}
                  onClick={openSuggest}
                  className="mb-1 disabled:cursor-not-allowed disabled:opacity-40 flex w-full items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{q.trim() ? `Khác: đề xuất “${q.trim()}”` : `Khác — đề xuất ${suggest.noun} mới`}</span>
                </button>
              )}
              {clearLabel && !multi && (
                <button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted cursor-pointer">
                  <X className="h-3.5 w-3.5" /> {clearLabel}
                </button>
              )}
              {groups.map(([letter, rows]) => (
                <div key={letter}>
                  <p className="sticky top-0 z-10 bg-card px-3 pb-0.5 pt-2 text-[11px] font-bold text-muted-foreground">{letter}</p>
                  {rows.map((o) => {
                    const selected = multi ? multi.values.includes(o.id) : o.id === value
                    const blocked = !!multi && full && !selected
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => pick(o.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                          selected && 'bg-muted/60 font-medium'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{o.name}</span>
                        {o.hint && <span className="shrink-0 text-[11px] text-muted-foreground">{o.hint}</span>}
                        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              ))}
              {total === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{suggest ? `Không thấy kết quả. Chọn “Khác” để đề xuất ${suggest.noun}.` : 'Không thấy kết quả.'}</p>}
            </div>
            {multi && (
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  Đã chọn {used}/{multi.max}
                  {full && ' — bỏ một mục để chọn thêm'}
                </span>
                <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
                  Xong
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5 text-base font-bold">
                {!startInSuggest && (
                  <button type="button" onClick={() => setView('list')} aria-label="Quay lại danh sách" className="-ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted cursor-pointer">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                Đề xuất {suggest.noun}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {suggest.hint ?? `Không thấy ${suggest.noun} của bạn? Gửi đề xuất, quản trị viên duyệt xong sẽ cập nhật cho bạn.`}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3 text-xs">
              {suggest.fields.map((f, i) => (
                <div key={f.key}>
                  <label className="mb-1 block font-semibold">
                    {f.label}
                    {f.required && ' *'}
                  </label>
                  {f.type === 'select' ? (
                    <select value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className={INPUT}>
                      <option value="">Chưa rõ</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      autoFocus={i === 0}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      maxLength={f.maxLength ?? 200}
                      placeholder={f.placeholder}
                      className={INPUT}
                    />
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">Trong lúc chờ duyệt, mục của bạn hiển thị là “Khác”. Nếu bị từ chối, mục vẫn là “Khác” cho tới khi bạn chọn lại.</p>
              {suggest.history && suggest.history.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <p className="text-[11px] font-semibold text-muted-foreground">Đề xuất của bạn</p>
                  <ul className="max-h-32 space-y-1.5 overflow-y-auto">
                    {suggest.history.map((h) => (
                      <li key={h.id} className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{h.name}</span>
                          {h.status === 'rejected' && h.note && <span className="block text-[11px] text-muted-foreground">Lý do: {h.note}</span>}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{STATUS_LABEL[h.status]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Đóng
                </Button>
                <Button type="submit" disabled={busy || missing} className="gap-1.5">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gửi đề xuất
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
