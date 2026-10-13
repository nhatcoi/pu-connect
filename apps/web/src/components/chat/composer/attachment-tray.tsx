'use client'

import React from 'react'
import { AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fileExt, fileSize } from '../utils'
import type { PendingFile } from './use-attachment-upload'

// Khay tệp đang đính kèm: ảnh thu nhỏ / thẻ tệp, thanh tiến trình, nút bỏ
export function AttachmentTray({ files, onRemove }: { files: PendingFile[]; onRemove: (id: string) => void }) {
  if (!files.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pt-1 pb-2">
      {files.map((f) => (
        <div
          key={f.id}
          className={cn(
            'relative shrink-0 h-16 rounded-lg overflow-hidden bg-muted border',
            f.previewUrl ? 'w-16' : 'w-44',
            f.status === 'error' && 'border-destructive/60'
          )}
        >
          {f.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.previewUrl} alt={f.file.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full flex items-center gap-2 px-2">
              <span className="h-9 w-9 shrink-0 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                {fileExt(f.file.name)}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium truncate">{f.file.name}</span>
                <span className="block text-[10px] text-muted-foreground">{fileSize(f.file.size)}</span>
              </span>
            </div>
          )}
          {f.status === 'uploading' && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${f.progress}%` }} />
            </div>
          )}
          {f.status === 'error' && (
            <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(f.id)}
            aria-label="Bỏ tệp"
            className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
