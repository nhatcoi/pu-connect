'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import type { ChatAttachment } from '@pu/schemas'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { fileExt, fileSize } from '../utils'

// Tệp trong tin nhắn: lưới ảnh (bấm để xem lớn) + thẻ tệp tải về
export function AttachmentView({ attachments, mine }: { attachments: ChatAttachment[]; mine: boolean }) {
  const images = attachments.filter((a) => a.kind === 'image')
  const files = attachments.filter((a) => a.kind !== 'image')
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {images.length > 0 && (
        <div
          className={cn(
            'grid gap-1 rounded-2xl overflow-hidden max-w-[320px]',
            images.length === 1 ? 'grid-cols-1' : images.length === 2 || images.length === 4 ? 'grid-cols-2' : 'grid-cols-3'
          )}
        >
          {images.map((img, i) => (
            <button key={img.key} onClick={() => setOpen(i)} className="relative block bg-muted cursor-zoom-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                loading="lazy"
                className={cn('object-cover', images.length === 1 ? 'max-h-80 w-auto max-w-full' : 'aspect-square w-full h-full')}
              />
            </button>
          ))}
        </div>
      )}
      {files.map((f) => (
        <FileCard key={f.key} file={f} />
      ))}
      {open !== null && <ImageLightbox images={images} index={open} onIndex={setOpen} />}
    </div>
  )
}

export function FileCard({ file, className }: { file: ChatAttachment; className?: string }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      download={file.name}
      className={cn('flex items-center gap-2.5 rounded-xl bg-card border px-3 py-2 w-64 max-w-full hover:bg-muted/60 transition-colors', className)}
    >
      <span className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
        {fileExt(file.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium truncate">{file.name}</span>
        <span className="block text-[11px] text-muted-foreground">{fileSize(file.size)}</span>
      </span>
      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
    </a>
  )
}

// Xem ảnh lớn, chuyển ảnh bằng nút hoặc phím ←/→
export function ImageLightbox({ images, index, onIndex }: { images: ChatAttachment[]; index: number; onIndex: (i: number | null) => void }) {
  const img = images[index]
  const go = (d: number) => onIndex((index + d + images.length) % images.length)
  return (
    <Dialog open onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] sm:max-w-4xl p-0 bg-black/95 border-none"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1)
          if (e.key === 'ArrowLeft') go(-1)
        }}
      >
        <DialogTitle className="sr-only">{img.name}</DialogTitle>
        <div className="relative flex items-center justify-center min-h-[50vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.name} className="max-h-[85vh] max-w-full object-contain" />
          {images.length > 1 && (
            <>
              <LightboxButton className="left-2" onClick={() => go(-1)} label="Ảnh trước">
                <ChevronLeft className="h-5 w-5" />
              </LightboxButton>
              <LightboxButton className="right-2" onClick={() => go(1)} label="Ảnh sau">
                <ChevronRight className="h-5 w-5" />
              </LightboxButton>
            </>
          )}
          <div className="absolute top-2 right-2 flex gap-1.5">
            <a
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              download={img.name}
              className="h-9 w-9 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"
              aria-label="Tải ảnh"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={() => onIndex(null)}
              className="h-9 w-9 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {images.length > 1 && (
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/80">
              {index + 1}/{images.length}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LightboxButton({ className, onClick, label, children }: { className: string; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 cursor-pointer',
        className
      )}
    >
      {children}
    </button>
  )
}
