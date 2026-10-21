'use client'

import React, { useMemo } from 'react'
import { Eye, EyeOff, FolderOpen, Loader2, Trash2 } from 'lucide-react'
import { fileExt } from '@/components/chat/utils'
import { startAttachmentDrag } from '@/components/chat/composer/use-file-drop'
import { DropZone } from '@/components/chat/composer/drop-zone'
import { Skeleton } from '@/components/ui/skeleton'
import { FilePreviewView, useFilePreview } from '@/components/viewer/file-preview-panel'
import { useAiLibrary, useAiSources } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import { AddSourceMenu } from '../sources/add-source-menu'
import { KIND_ICON, mergeEntries, type DocEntry } from '../sources/doc-entries'
import { SourceView } from '../sources/source-view'
import { openDoc, useSourceView } from '../sources/source-view-store'
import { useAddSources, type UploadingFile } from '../sources/use-add-sources'

// Tài liệu của cuộc trò chuyện (không có thread ⇒ của thư viện): tài liệu đã thêm + tệp đã gửi trong tin nhắn, mới trước
export function useDocEntries(threadId?: string) {
  const { sources, isPending: sourcesPending } = useAiSources(threadId)
  const { items, isPending: filesPending } = useAiLibrary('file', threadId)
  const entries = useMemo(() => mergeEntries(sources, items.flatMap((i) => i.attachments)), [sources, items])
  return { entries, isPending: sourcesPending || filesPending }
}

// Tab Tài liệu: đang xem 1 tài liệu ⇒ xem trước; không thì danh sách (kéo tệp vào đây để thêm)
export function PanelDocs({ threadId }: { threadId?: string }) {
  const { file, close: closeFile } = useFilePreview()
  const { source, close: closeSource } = useSourceView()
  const { entries, isPending } = useDocEntries(threadId)
  const adder = useAddSources(threadId)

  if (file) return <FilePreviewView file={file} onClose={closeFile} />
  if (source) return <SourceView source={source} onClose={closeSource} />

  const empty = !isPending && !entries.length && !adder.uploading.length
  return (
    <DropZone label="Thả để thêm vào tài liệu" onFiles={(files) => void adder.addFiles(files)} onAttachment={adder.addAttachment} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3 pb-1">
        <p className="truncate text-[11px] text-muted-foreground">{threadId ? 'Tài liệu trong cuộc trò chuyện này' : 'Tài liệu của bạn'}</p>
        <AddSourceMenu adder={adder} inThread={!!threadId} />
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {adder.uploading.map((u) => (
          <UploadingRow key={u.id} upload={u} />
        ))}
        {isPending ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
        ) : empty ? (
          <div className="space-y-2 px-4 py-12 text-center text-muted-foreground">
            <FolderOpen className="mx-auto h-9 w-9 text-primary opacity-30" />
            <p className="text-xs leading-relaxed">Kéo tệp vào đây, hoặc bấm “Thêm tài liệu” để tải tệp, dán văn bản, thêm link web hay YouTube. N7AI sẽ đọc để tóm tắt, tạo quiz, flashcard…</p>
          </div>
        ) : (
          entries.map((entry) => (
            <DocRow
              key={entry.id}
              entry={entry}
              onRemove={entry.source ? () => adder.remove(entry.source!.id) : undefined}
              onToggleContext={entry.source && threadId ? () => adder.setInContext({ id: entry.source!.id, inContext: !entry.source!.inContext }) : undefined}
            />
          ))
        )}
      </div>
    </DropZone>
  )
}

const rowClass = 'flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-left'

// Một tài liệu: tệp kéo được vào ô chat; tài liệu đã thêm có nút bật / tắt cho N7AI đọc và nút xóa
export function DocRow({ entry, onRemove, onToggleContext, selected }: { entry: DocEntry; onRemove?: () => void; onToggleContext?: () => void; selected?: boolean }) {
  const Icon = KIND_ICON[entry.kind]
  const att = entry.attachment
  const inContext = entry.source?.inContext ?? true
  return (
    <div className={cn('group relative', !inContext && 'opacity-60')}>
      <button
        type="button"
        draggable={!!att}
        onDragStart={att ? (e) => startAttachmentDrag(e, att) : undefined}
        onClick={() => openDoc(entry)}
        title={att ? 'Bấm để xem · kéo vào ô chat để đính kèm' : 'Bấm để xem'}
        className={cn(rowClass, 'cursor-pointer transition-colors hover:bg-muted/60', onRemove && (onToggleContext ? 'pr-[4.75rem]' : 'pr-10'), selected && 'border-primary ring-1 ring-primary/40')}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
          {att ? fileExt(att.name) : <Icon className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{entry.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{inContext ? entry.subtitle : 'Đã tắt · N7AI không đọc'}</span>
        </span>
      </button>
      {onToggleContext && (
        <button
          type="button"
          onClick={onToggleContext}
          aria-pressed={inContext}
          aria-label={inContext ? `Tắt ${entry.title} khỏi ngữ cảnh` : `Bật ${entry.title} vào ngữ cảnh`}
          title={inContext ? 'N7AI đang đọc tài liệu này ở mọi lượt trả lời — bấm để tắt' : 'N7AI không đọc tài liệu này — bấm để bật lại'}
          className={cn(
            'absolute right-9 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-muted',
            inContext ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {inContext ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Bỏ ${entry.title}`}
          title="Bỏ khỏi tài liệu"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function UploadingRow({ upload }: { upload: UploadingFile }) {
  return (
    <div className={cn(rowClass, 'relative overflow-hidden')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{upload.name}</span>
        <span className="block text-[11px] text-muted-foreground">Đang tải lên… {upload.progress}%</span>
      </span>
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/70 transition-[width]" style={{ width: `${upload.progress}%` }} />
    </div>
  )
}
