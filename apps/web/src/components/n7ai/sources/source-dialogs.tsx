'use client'

import React, { useMemo, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { AiSourceInputSchema } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiLibrary, useAiSources } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import { KIND_ICON, mergeEntries, type DocEntry } from './doc-entries'
import type { SourceAdder } from './use-add-sources'

const TEXT_MAX = 100_000
const fieldClass = 'w-full rounded-xl border border-border bg-muted/40 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Lỗi đầu tiên của schema dùng chung với API (cùng thông báo)
const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) => (result.success ? null : (result.error?.issues[0]?.message ?? 'Dữ liệu không hợp lệ'))

// Dán văn bản (ghi chú, đề cương, đoạn bài giảng…) làm tài liệu
export function AddTextDialog({ open, onOpenChange, adder }: DialogProps & { adder: SourceAdder }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    const message = firstError(AiSourceInputSchema.safeParse({ type: 'text', title, content }))
    setError(message)
    if (message) return
    setPending(true)
    try {
      await adder.addText(title.trim(), content.trim())
      setTitle('')
      setContent('')
      onOpenChange(false)
    } catch {
      // lỗi từ máy chủ đã báo bằng toast
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">Dán văn bản</DialogTitle>
          <DialogDescription className="text-xs">N7AI sẽ đọc đoạn văn bản này để tóm tắt, tạo quiz, flashcard… như một tài liệu.</DialogDescription>
        </DialogHeader>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Tên tài liệu (không bắt buộc)" className={cn(fieldClass, 'h-10')} />
        <div className="space-y-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="Dán nội dung vào đây…"
            aria-invalid={!!error}
            className={cn(fieldClass, 'resize-none py-2.5 leading-relaxed')}
          />
          <p className={cn('text-right text-[11px]', content.length > TEXT_MAX ? 'text-destructive' : 'text-muted-foreground')}>
            {content.length.toLocaleString('vi-VN')} / {TEXT_MAX.toLocaleString('vi-VN')} ký tự
          </p>
        </div>
        {error && <p className="-mt-2 text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button className="gap-2 rounded-full" disabled={pending || !content.trim()} onClick={() => void submit()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Thêm tài liệu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Liên kết trang web hoặc video YouTube (cần phụ đề) làm tài liệu
export function AddLinkDialog({ open, onOpenChange, adder }: DialogProps & { adder: SourceAdder }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    const message = firstError(AiSourceInputSchema.safeParse({ type: 'link', url }))
    setError(message)
    if (message) return
    setPending(true)
    try {
      await adder.addLink(url.trim())
      setUrl('')
      onOpenChange(false)
    } catch {
      // lỗi từ máy chủ (không đọc được trang, video không có phụ đề…) đã báo bằng toast
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">Thêm liên kết</DialogTitle>
          <DialogDescription className="text-xs">Trang web công khai hoặc video YouTube có phụ đề. N7AI đọc nội dung để tóm tắt, tạo quiz, flashcard…</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            placeholder="https://… hoặc link YouTube"
            aria-invalid={!!error}
            className={cn(fieldClass, 'h-10')}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {pending && <p className="text-xs text-muted-foreground">Đang đọc nội dung, có thể mất vài giây…</p>}
        </form>
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button className="gap-2 rounded-full" disabled={pending || !url.trim()} onClick={() => void submit()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Thêm liên kết
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Chọn tài liệu từ thư viện (tệp đã gửi cho N7AI + tài liệu đã thêm vào thư viện) để thêm vào cuộc trò chuyện
export function LibraryPickerDialog({ open, onOpenChange, adder }: DialogProps & { adder: SourceAdder }) {
  const library = useAiLibrary('file')
  const librarySources = useAiSources() // thư viện: không gắn thread
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)

  const attachments = useMemo(() => library.items.flatMap((i) => i.attachments), [library.items])
  const entries = useMemo(() => mergeEntries(librarySources.sources, attachments), [librarySources.sources, attachments])
  const inThread = useMemo(() => new Set(adder.sources.flatMap((s) => (s.attachment ? [`file:${s.attachment.key}`] : [`source:${s.id}`]))), [adder.sources])
  const loading = library.isPending || librarySources.isPending

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const submit = async () => {
    setPending(true)
    for (const entry of entries.filter((e) => picked.has(e.id))) {
      if (entry.source && !entry.attachment) await adder.copyFrom(entry.source).catch(() => undefined)
      else if (entry.attachment) adder.addAttachment(entry.attachment)
    }
    setPending(false)
    setPicked(new Set())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">Thêm từ thư viện</DialogTitle>
          <DialogDescription className="text-xs">Chọn tài liệu bạn đã gửi cho N7AI hoặc đã thêm vào thư viện.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)
          ) : !entries.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Thư viện chưa có tài liệu nào.</p>
          ) : (
            entries.map((e) => <PickRow key={e.id} entry={e} picked={picked.has(e.id)} disabled={!!e.attachment && inThread.has(e.id)} onToggle={() => toggle(e.id)} />)
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button className="gap-2 rounded-full" disabled={pending || !picked.size} onClick={() => void submit()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Thêm {picked.size ? `${picked.size} tài liệu` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PickRow({ entry, picked, disabled, onToggle }: { entry: DocEntry; picked: boolean; disabled: boolean; onToggle: () => void }) {
  const Icon = KIND_ICON[entry.kind]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={picked}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-50',
        picked ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/60'
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{entry.title}</span>
        <span className="block text-[11px] text-muted-foreground">{disabled ? 'Đã có trong cuộc trò chuyện' : entry.subtitle}</span>
      </span>
      {picked && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  )
}

