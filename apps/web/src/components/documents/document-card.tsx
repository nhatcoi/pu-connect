'use client'

import React from 'react'
import Link from 'next/link'
import type { AttachedDocument } from '@pu/schemas'
import { DOC_CATEGORY_LABELS } from '@pu/schemas'
import { Bookmark, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentThumbnail } from './document-thumbnail'
import { formatDocSize } from './document-format'
import { SaveDocumentButton } from './save-document-button'
import { RatingBadge } from './star-rating'

type CardDocument = AttachedDocument & { ownerName?: string; saveCount?: number; ratingAvg?: number; ratingCount?: number }

// Thẻ tài liệu kiểu kệ sách: ảnh trang đầu, loại + môn, tên, lượt tải / lưu. Bấm ⇒ trang chi tiết
export function DocumentCard({ document: doc, className }: { document: CardDocument; className?: string }) {
  return (
    <article className={cn('group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md', className)}>
      <Link href={`/documents/${doc.id}`} className="flex min-h-0 flex-1 flex-col">
        <DocumentThumbnail document={doc} className="aspect-[4/3] w-full border-b border-border" />
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            {doc.courseName && <span className="max-w-full truncate rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">{doc.courseName}</span>}
            {doc.docCategory && <span>{DOC_CATEGORY_LABELS[doc.docCategory]}</span>}
          </p>
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground group-hover:text-primary">{doc.title}</h3>
          <p className="mt-auto flex items-center gap-2.5 pt-1 text-[11px] text-muted-foreground">
            {doc.academicYear && <span>{doc.academicYear}</span>}
            {formatDocSize(doc.fileSize) && <span>{formatDocSize(doc.fileSize)}</span>}
            <RatingBadge avg={doc.ratingAvg ?? 0} count={doc.ratingCount ?? 0} className="text-[11px]" />
            <span className="ml-auto inline-flex items-center gap-0.5">
              <Download className="h-3 w-3" /> {doc.downloadCount}
            </span>
            {!!doc.saveCount && (
              <span className="inline-flex items-center gap-0.5">
                <Bookmark className="h-3 w-3" /> {doc.saveCount}
              </span>
            )}
          </p>
        </div>
      </Link>
      <SaveDocumentButton documentId={doc.id} className="absolute right-2 top-2 rounded-full bg-background/90 shadow-sm backdrop-blur" />
    </article>
  )
}
