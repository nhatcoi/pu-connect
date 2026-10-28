'use client'

import React, { useState } from 'react'
import { Check, FolderPlus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCollectionActions, useCollectionMembership } from '@/hooks/use-document-community'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

// Nút "Bộ sưu tập" trên trang tài liệu: tick để thêm / bỏ tài liệu khỏi từng bộ của mình, hoặc tạo bộ mới ngay tại chỗ
export function AddToCollection({ documentId }: { documentId: string }) {
  const user = useAppStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const membership = useCollectionMembership(documentId, open && !!user)
  const { create, setDocument } = useCollectionActions()

  const createAndAdd = async () => {
    const name = title.trim()
    if (!name) return
    try {
      const made = await create.mutateAsync({ title: name, visibility: 'public' })
      await setDocument.mutateAsync({ id: made.id, documentId, add: true })
      setTitle('')
      void membership.refetch()
      toast.success(`Đã thêm vào bộ “${name}”`)
    } catch {
      // lỗi đã báo qua toast của mutation
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next && !user ? toast.info('Đăng nhập để tạo bộ sưu tập') : setOpen(next))}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs">
          <FolderPlus className="h-3.5 w-3.5" /> Bộ sưu tập
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-2">
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {membership.isPending ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Đang tải…</p>
          ) : membership.data?.length ? (
            membership.data.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={setDocument.isPending}
                onClick={() => setDocument.mutate({ id: c.id, documentId, add: !c.hasDocument }, { onSuccess: () => void membership.refetch() })}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted cursor-pointer"
              >
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', c.hasDocument ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  {c.hasDocument && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">Bạn chưa có bộ sưu tập nào.</p>
          )}
        </div>
        <form
          className="flex items-center gap-1.5 border-t border-border pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void createAndAdd()
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bộ mới, vd. Ôn thi Giải tích" maxLength={120} className="h-8 text-xs" />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!title.trim() || create.isPending} aria-label="Tạo bộ">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
