'use client'

import React, { useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { create } from 'zustand'
import { Download, ExternalLink, FileQuestion, X } from 'lucide-react'
import type { ChatAttachment } from '@pu/schemas'
import { fileExt, fileSize } from '@/components/chat/utils'
import { cn } from '@/lib/utils'

type PreviewFile = Pick<ChatAttachment, 'url' | 'name' | 'size' | 'mime'>
type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'office' | 'text' | 'none'

// Tệp đang xem (mở từ thẻ tệp ở chat / thư viện / thông tin hội thoại)
// hosted: bố cục có panel xem tệp riêng (N7AI desktop) ⇒ panel nổi chỉ dùng cho màn nhỏ
export const useFilePreview = create<{ file: PreviewFile | null; seq: number; hosted: number; open: (file: PreviewFile) => void; close: () => void }>((set) => ({
  file: null,
  seq: 0,
  hosted: 0,
  open: (file) => set((s) => ({ file, seq: s.seq + 1 })),
  close: () => set({ file: null })
}))

// Bố cục có panel xem tệp riêng; rời bố cục ⇒ đóng tệp đang xem
export function useFilePreviewHost() {
  useEffect(() => {
    useFilePreview.setState((s) => ({ hosted: s.hosted + 1 }))
    return () => useFilePreview.setState((s) => ({ hosted: s.hosted - 1, file: null }))
  }, [])
}

const OFFICE = /^(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/
const TEXT = /^(txt|md|csv|tsv|json|xml|ya?ml|log|tex|py|js|ts|tsx|jsx|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|sql|sh|html?|css)$/

// Loại xem trước theo mime + đuôi tệp (học đường: PDF, Word/Excel/PowerPoint, ảnh, video, âm thanh, văn bản/mã nguồn)
export function previewKind(file: PreviewFile): PreviewKind {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const mime = file.mime || ''
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (OFFICE.test(ext)) return 'office'
  if (mime.startsWith('text/') || TEXT.test(ext)) return 'text'
  return 'none'
}

// Office Online chỉ đọc tệp qua URL công khai (R2 public) ⇒ nhúng trình xem của Microsoft
const officeViewer = (url: string) => `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

function PreviewBody({ file }: { file: PreviewFile }) {
  const kind = previewKind(file)
  const frame = 'h-full w-full rounded-xl border bg-white shadow-sm'
  switch (kind) {
    case 'pdf':
      return <iframe src={file.url} title={file.name} className={frame} />
    case 'office':
      return <iframe src={officeViewer(file.url)} title={file.name} className={frame} />
    case 'text':
      return <iframe src={file.url} title={file.name} className={frame} sandbox="" />
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={file.url} alt={file.name} className="max-h-full max-w-full rounded-xl object-contain shadow-sm" />
    case 'video':
      return <video src={file.url} controls className="max-h-full max-w-full rounded-xl bg-black shadow-sm" />
    case 'audio':
      return <audio src={file.url} controls className="w-full max-w-md" />
    default:
      return (
        <div className="space-y-2 text-center text-muted-foreground">
          <FileQuestion className="mx-auto h-10 w-10 opacity-40" />
          <p className="text-sm">Chưa xem trước được định dạng này.</p>
          <a href={file.url} download={file.name} className="text-sm font-medium text-primary hover:underline">
            Tải về để mở
          </a>
        </div>
      )
  }
}

const iconBtn = 'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Thanh tên tệp + vùng xem (dùng chung cho panel N7AI và panel nổi)
export function FilePreviewView({ file, title, onClose }: { file: PreviewFile; title?: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">{fileExt(file.name)}</span>
        <div className="min-w-0 flex-1">
          {title ?? <p className="truncate text-sm font-medium">{file.name}</p>}
          <p className="text-[11px] text-muted-foreground">{fileSize(file.size)}</p>
        </div>
        <a href={file.url} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Mở tab mới">
          <ExternalLink className="h-4 w-4" />
        </a>
        <a href={file.url} download={file.name} className={iconBtn} aria-label="Tải về">
          <Download className="h-4 w-4" />
        </a>
        <button type="button" onClick={onClose} className={iconBtn} aria-label="Đóng">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/40 p-3 sm:p-4">
        <PreviewBody key={file.url} file={file} />
      </div>
    </>
  )
}

const slideIn = 'duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right'

// Panel nổi trượt từ cạnh phải (không phủ tối, vẫn thao tác được bên trái; Esc / X để đóng). Mobile: toàn màn hình
// Bố cục có panel riêng ⇒ chỉ hiện ở màn nhỏ
export function FilePreviewPanel() {
  const { file, hosted, close } = useFilePreview()
  return (
    <DialogPrimitive.Root open={!!file} onOpenChange={(o) => !o && close()} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn('fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-surface shadow-2xl outline-none md:w-[min(760px,52vw)]', slideIn, hosted > 0 && 'lg:hidden')}
        >
          {file && <FilePreviewView file={file} onClose={close} title={<DialogPrimitive.Title className="truncate text-sm font-medium">{file.name}</DialogPrimitive.Title>} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
