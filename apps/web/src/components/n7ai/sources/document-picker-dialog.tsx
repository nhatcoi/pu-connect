'use client'

import React, { useState } from 'react'
import { Check, FileText, FolderOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useCollections } from '@/hooks/use-document-community'
import { useLibrary } from '@/hooks/use-document-library'
import { cn } from '@/lib/utils'
import type { SourceAdder } from './use-add-sources'

type Tab = 'collections' | 'saved'

// Thêm tài liệu từ kho: cả bộ sưu tập (của mình hoặc công khai) hoặc tài liệu đã lưu; tệp vẫn nằm ở kho, không sao chép
export function DocumentPickerDialog({ open, onOpenChange, adder }: { open: boolean; onOpenChange: (open: boolean) => void; adder: SourceAdder }) {
  const [tab, setTab] = useState<Tab>('collections')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-base">Thêm từ kho tài liệu</DialogTitle>
          <DialogDescription className="text-xs">Chọn bộ sưu tập hoặc tài liệu đã lưu để N7AI đọc cùng bạn.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5">
          {(['collections', 'saved'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn('h-8 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors', tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              {t === 'collections' ? 'Bộ sưu tập' : 'Tài liệu đã lưu'}
            </button>
          ))}
        </div>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">{tab === 'collections' ? <CollectionRows adder={adder} /> : <SavedRows adder={adder} onDone={() => onOpenChange(false)} />}</div>
      </DialogContent>
    </Dialog>
  )
}

function CollectionRows({ adder }: { adder: SourceAdder }) {
  const mine = useCollections('mine')
  const pub = useCollections('public')
  const [busy, setBusy] = useState<string | null>(null)
  const loading = mine.isPending && pub.isPending
  const rows = [...mine.items, ...pub.items.filter((c) => !mine.items.some((m) => m.id === c.id))].filter((c) => c.itemCount > 0)

  if (loading) return <>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</>
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có bộ sưu tập nào có tài liệu.</p>
  return (
    <>
      {rows.map((c) => (
        <div key={c.id} className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderOpen className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{c.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {c.itemCount} tài liệu · {c.isMine ? 'của bạn' : c.ownerName}
            </span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 rounded-full px-3 text-xs"
            disabled={busy !== null}
            onClick={() => {
              setBusy(c.id)
              void adder.addCollection(c.id).catch(() => undefined).finally(() => setBusy(null))
            }}
          >
            {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Thêm cả bộ'}
          </Button>
        </div>
      ))}
    </>
  )
}

function SavedRows({ adder, onDone }: { adder: SourceAdder; onDone: () => void }) {
  const saved = useLibrary('saved')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)
  const inThread = new Set(adder.sources.flatMap((s) => (s.meta?.documentId ? [s.meta.documentId] : [])))

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const submit = async () => {
    setPending(true)
    for (const id of picked) await adder.addDocument(id).catch(() => undefined) // lỗi đã báo toast
    setPending(false)
    onDone()
  }

  if (saved.isPending) return <>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</>
  if (!saved.items.length) return <p className="py-10 text-center text-sm text-muted-foreground">Bạn chưa lưu tài liệu nào. Mở một tài liệu và bấm “Lưu” để thêm vào kho.</p>
  return (
    <>
      {saved.items.map(({ document: d }) => {
        const has = inThread.has(d.id)
        const on = picked.has(d.id)
        return (
          <button
            key={d.id}
            type="button"
            disabled={has}
            onClick={() => toggle(d.id)}
            aria-pressed={on}
            className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-50', on ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/60')}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{d.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{has ? 'Đã có ở đây' : (d.courseName ?? 'Chưa phân môn')}</span>
            </span>
            {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        )
      })}
      {saved.hasNextPage && (
        <Button variant="ghost" size="sm" className="w-full rounded-full text-xs" disabled={saved.isFetchingNextPage} onClick={() => void saved.fetchNextPage()}>
          Xem thêm
        </Button>
      )}
      <div className="sticky bottom-0 flex justify-end bg-background pt-2">
        <Button className="gap-2 rounded-full" disabled={pending || !picked.size} onClick={() => void submit()}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Thêm {picked.size ? `${picked.size} tài liệu` : ''}
        </Button>
      </div>
    </>
  )
}
