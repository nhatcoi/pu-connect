'use client'

import React, { useMemo } from 'react'
import { FolderOpen } from 'lucide-react'
import type { ChatAttachment } from '@pu/schemas'
import { fileExt, fileSize } from '@/components/chat/utils'
import { startAttachmentDrag } from '@/components/chat/composer/use-file-drop'
import { Skeleton } from '@/components/ui/skeleton'
import { FilePreviewView, useFilePreview } from '@/components/viewer/file-preview-panel'
import { useAiLibrary } from '@/hooks/chat'
import { cn } from '@/lib/utils'

// Tệp đã gửi trong thread (không có thread ⇒ mọi thread), mới trước
export function useThreadFiles(threadId?: string) {
  const { items, isPending } = useAiLibrary('file', threadId)
  const files = useMemo(() => items.flatMap((i) => i.attachments), [items])
  return { files, isPending }
}

// Tab Tài liệu: đang xem 1 tệp ⇒ xem trước; không thì danh sách tệp của cuộc trò chuyện
export function PanelDocs({ threadId }: { threadId?: string }) {
  const { file, open, close } = useFilePreview()
  const { files, isPending } = useThreadFiles(threadId)

  if (file) return <FilePreviewView file={file} onClose={close} />
  return (
    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
      <p className="px-1 pb-1 text-[11px] text-muted-foreground">{threadId ? 'Tài liệu trong cuộc trò chuyện này' : 'Tài liệu đã gửi cho N7AI'}</p>
      {isPending ? (
        Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
      ) : !files.length ? (
        <div className="space-y-2 py-12 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-9 w-9 text-primary opacity-30" />
          <p className="text-xs">Gửi PDF, Word, slide… trong ô chat để xem và học từ tài liệu ở đây.</p>
        </div>
      ) : (
        files.map((f) => <FileRow key={f.key} file={f} onOpen={() => open(f)} />)
      )}
    </div>
  )
}

export function FileRow({ file, onOpen, selected }: { file: ChatAttachment; onOpen: () => void; selected?: boolean }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => startAttachmentDrag(e, file)}
      onClick={onOpen}
      title="Bấm để xem · kéo vào ô chat để đính kèm lại"
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/60',
        selected && 'border-primary ring-1 ring-primary/40'
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">{fileExt(file.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{file.name}</span>
        <span className="block text-[11px] text-muted-foreground">{fileSize(file.size)}</span>
      </span>
    </button>
  )
}
