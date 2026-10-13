'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { ChatAttachment } from '@pu/schemas'
import { chatApi } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'
import { FileCard, ImageLightbox } from '../thread/attachment-view'

// Kho "Ảnh" / "Tệp" đã gửi trong hội thoại
export function MediaPanel({ conversationId, kind }: { conversationId: string; kind: 'image' | 'file' }) {
  const [open, setOpen] = useState<number | null>(null)
  const { data = [], isPending } = useQuery({
    queryKey: queryKeys.chatMedia(conversationId, kind),
    queryFn: () => chatApi.attachments(conversationId, kind),
    staleTime: 60 * 1000
  })
  const items: ChatAttachment[] = data.flatMap((m) => (m.attachments || []).filter((a) => a.kind === kind))

  if (isPending) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    )
  }
  if (!items.length) return <p className="py-6 text-center text-xs text-muted-foreground">{kind === 'image' ? 'Chưa có ảnh nào.' : 'Chưa có tệp nào.'}</p>

  if (kind === 'file') {
    return (
      <div className="space-y-1.5">
        {items.map((f) => (
          <FileCard key={f.key} file={f} className="w-full" />
        ))}
      </div>
    )
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
        {items.map((img, i) => (
          <button key={img.key} onClick={() => setOpen(i)} className="aspect-square bg-muted cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name} loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && <ImageLightbox images={items} index={open} onIndex={setOpen} />}
    </>
  )
}
