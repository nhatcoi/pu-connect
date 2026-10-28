'use client'

import React from 'react'
import Link from 'next/link'
import type { DocumentCollection } from '@pu/schemas'
import { FolderOpen, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentThumbnail } from './document-thumbnail'

// Thẻ bộ sưu tập: 3 ảnh bìa xếp chồng + tên, người tạo, số tài liệu
export function CollectionCard({ collection: c, className }: { collection: DocumentCollection; className?: string }) {
  return (
    <Link href={`/collections/${c.id}`} className={cn('group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md', className)}>
      <div className="grid aspect-[4/3] grid-cols-3 gap-px border-b border-border bg-border">
        {c.covers.length === 0 ? (
          <div className="col-span-3 flex items-center justify-center bg-muted text-muted-foreground">
            <FolderOpen className="h-8 w-8 opacity-50" />
          </div>
        ) : (
          [0, 1, 2].map((i) =>
            c.covers[i] ? <DocumentThumbnail key={c.covers[i].id} document={c.covers[i]} className="h-full w-full" /> : <div key={i} className="bg-muted" />
          )
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug group-hover:text-primary">{c.title}</h3>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {c.visibility === 'private' && <Lock className="h-3 w-3" />}
          <span className="truncate">{c.isMine ? 'Của bạn' : c.ownerName}</span>
          <span>· {c.itemCount} tài liệu</span>
        </p>
      </div>
    </Link>
  )
}
