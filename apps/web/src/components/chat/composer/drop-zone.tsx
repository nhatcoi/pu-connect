'use client'

import React, { useRef, useState } from 'react'
import type { ChatAttachment } from '@pu/schemas'
import { cn } from '@/lib/utils'
import { readDrop, useDragMonitor } from './use-file-drop'

// Vùng thả riêng (panel tài liệu, thư viện): khi kéo tệp vào trang, viền nét đứt báo vùng này nhận tệp, đậm hơn khi đang rê lên
export function DropZone({
  label,
  onFiles,
  onAttachment,
  tall,
  className,
  children
}: {
  label: string
  onFiles: (files: File[]) => void
  onAttachment: (attachment: ChatAttachment) => void
  tall?: boolean // vùng cao hơn màn hình (trang thư viện): nhãn bám theo giữa màn hình
  className?: string
  children: React.ReactNode
}) {
  const { active } = useDragMonitor()
  const [over, setOver] = useState(false)
  const depth = useRef(0)

  return (
    <div
      data-drop-zone
      className={cn('relative', className)}
      onDragEnter={() => {
        depth.current++
        setOver(true)
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setOver(false)
        const { files, attachment } = readDrop(e)
        if (files.length) onFiles(files)
        else if (attachment) onAttachment(attachment)
      }}
    >
      {children}
      {active && (
        <div
          className={cn(
            'pointer-events-none absolute inset-1.5 z-20 flex justify-center rounded-2xl border-2 border-dashed transition-colors',
            tall ? 'items-start' : 'items-center',
            over ? 'border-primary bg-primary/10 backdrop-blur-[1px]' : 'border-primary/30 bg-primary/[0.03]'
          )}
        >
          <span className={cn('rounded-full bg-card px-4 py-2 text-xs font-medium shadow ring-1 ring-border', tall && 'sticky top-[40vh]', over ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
        </div>
      )}
    </div>
  )
}
