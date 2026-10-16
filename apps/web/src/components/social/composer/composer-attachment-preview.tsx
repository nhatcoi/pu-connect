'use client'

import React from 'react'
import { FileText, X, Hash, UserPlus, AlignLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AttachedFile {
  id: string
  name: string
  size: number
  type: 'image' | 'document'
  url: string
  file?: File
}

interface ComposerAttachmentPreviewProps {
  files: AttachedFile[]
  tags: string[]
  onRemoveFile: (id: string) => void
  onRemoveTag: (tag: string) => void
}

export function ComposerAttachmentPreview({ files, tags, onRemoveFile, onRemoveTag }: ComposerAttachmentPreviewProps) {
  const images = files.filter((f) => f.type === 'image')
  const docs = files.filter((f) => f.type === 'document')

  if (files.length === 0 && tags.length === 0) return null

  return (
    <div className="space-y-3 pt-2">
      {/* 1. X-Style Rich Image Preview Grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div
            className={cn(
              'grid gap-2 overflow-hidden rounded-2xl border border-border/80 bg-muted/20',
              images.length === 1 && 'grid-cols-1',
              images.length === 2 && 'grid-cols-2',
              images.length === 3 && 'grid-cols-2',
              images.length >= 4 && 'grid-cols-2'
            )}
          >
            {images.map((img, idx) => (
              <div
                key={img.id}
                className={cn(
                  'group relative overflow-hidden bg-black/5',
                  images.length === 1 && 'max-h-[380px]',
                  images.length === 2 && 'h-60',
                  images.length === 3 && idx === 0 && 'row-span-2 h-full min-h-[240px]',
                  images.length === 3 && idx > 0 && 'h-[120px]',
                  images.length >= 4 && 'h-40'
                )}
              >
                {/* Image element */}
                {/* eslint-disable-next-line @next/next/no-img-element -- xem trước tệp vừa chọn (blob URL) */}
                <img src={img.url} alt={img.name} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]" />

                {/* Top-Left Edit Button */}
                <div className="absolute top-2.5 left-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold px-2.5 py-1 backdrop-blur-xs transition-colors cursor-pointer"
                  >
                    <span>Edit</span>
                  </button>
                </div>

                {/* Top-Right Close Button (X style) */}
                <button
                  type="button"
                  onClick={() => onRemoveFile(img.id)}
                  className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 hover:bg-black text-white transition-all cursor-pointer shadow-sm hover:scale-105"
                  title="Gỡ ảnh"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Sub-actions below image (Tag people / Add description) */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
              <UserPlus className="h-3.5 w-3.5" />
              <span>Gắn thẻ người khác</span>
            </button>
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
              <AlignLeft className="h-3.5 w-3.5" />
              <span>Mô tả ảnh</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Document Attachments (PDF / Slide) */}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-foreground shadow-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background border border-border text-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0 max-w-[200px]">
                <span className="truncate font-semibold text-[11px] leading-tight text-foreground">{doc.name}</span>
                <span className="text-[10px] text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(doc.id)}
                className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors cursor-pointer"
                title="Gỡ tệp"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 3. Hashtags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <div
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[11px] font-medium text-foreground"
            >
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Xóa tag"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
