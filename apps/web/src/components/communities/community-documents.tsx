'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCommunityDocumentActions, useCommunityDocumentCandidates, useCommunityDocuments } from '@/hooks/use-community-extras'
import { formatRelativeTime } from '@/lib/utils'

const sizeLabel = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// Tab "Tài liệu": kho tài liệu chung của cộng đồng; thành viên chia sẻ tài liệu công khai của mình vào
export function CommunityDocuments({ slug, isMember, canManage }: { slug: string; isMember: boolean; canManage: boolean }) {
  const { data: docs, isLoading } = useCommunityDocuments(slug)
  const { remove } = useCommunityDocumentActions(slug)
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-primary font-semibold text-[15px]">
          <FileText className="h-5 w-5" />
          Tài liệu cộng đồng
        </div>
        {isMember && (
          <Button size="sm" className="h-8 gap-1.5 rounded-full text-xs font-semibold" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Chia sẻ tài liệu
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !docs?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chưa có tài liệu nào được chia sẻ.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-primary/70" />
              <Link href={`/documents/${d.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.ownerName} · {sizeLabel(d.fileSize)} · {formatRelativeTime(d.addedAt)}
                </p>
              </Link>
              {(d.addedByMe || canManage) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                  title="Gỡ khỏi cộng đồng"
                  aria-label="Gỡ khỏi cộng đồng"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(d.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isMember && <DocumentPicker slug={slug} open={pickerOpen} onOpenChange={setPickerOpen} />}
    </div>
  )
}

function DocumentPicker({ slug, open, onOpenChange }: { slug: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: candidates, isLoading } = useCommunityDocumentCandidates(slug, open)
  const { add } = useCommunityDocumentActions(slug)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Chia sẻ tài liệu của bạn</DialogTitle>
          <DialogDescription className="text-xs">Chọn tài liệu công khai trong thư viện. File gốc không bị nhân đôi.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !candidates?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bạn chưa có tài liệu công khai nào để chia sẻ.{' '}
              <Link href="/documents" className="text-primary underline">
                Tải tài liệu lên
              </Link>
            </p>
          ) : (
            candidates.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" disabled={add.isPending} onClick={() => add.mutate(c.id)}>
                  Chia sẻ
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
