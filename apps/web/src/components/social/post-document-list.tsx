'use client'

import React from 'react'
import Link from 'next/link'
import type { AttachedDocument } from '@pu/schemas'
import { Download, FileText, Library } from 'lucide-react'
import { openDocument } from '@/lib/document-api'
import { cn } from '@/lib/utils'
import { docMetaLine } from '@/components/documents/document-format'
import { SaveDocumentButton } from '@/components/documents/save-document-button'

// Tài liệu đính kèm bài viết / bình luận: loại, môn, đã vào kho môn học; bấm tên ⇒ trang chi tiết, nút tải ⇒ mở tệp (đếm lượt tải)
export function PostDocumentList({ documents, compact = false }: { documents: AttachedDocument[]; compact?: boolean }) {
  if (!documents.length) return null
  return (
    <div className="space-y-1.5">
      {documents.map((doc) => {
        const meta = docMetaLine(doc)
        return (
          <div
            key={doc.id}
            className={cn('flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 text-xs', compact ? 'px-2.5 py-1.5' : 'px-3 py-2')}
          >
            <div className={cn('flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary', compact ? 'h-7 w-7' : 'h-8 w-8')}>
              <FileText className="h-4 w-4" />
            </div>
            <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1 group">
              <p className="truncate font-semibold text-foreground group-hover:text-primary group-hover:underline">{doc.title}</p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                {meta && <span>{meta}</span>}
                {doc.listed && (
                  <span className="inline-flex items-center gap-0.5 text-primary">
                    <Library className="h-3 w-3" /> Kho môn học
                  </span>
                )}
              </p>
            </Link>
            {doc.courseCode && (
              <Link
                href={`/courses/${encodeURIComponent(doc.courseCode)}`}
                className="max-w-[40%] shrink-0 truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/15"
              >
                {doc.courseName ?? 'Môn học'}
              </Link>
            )}
            <SaveDocumentButton documentId={doc.id} />
            <button
              type="button"
              onClick={() => void openDocument(doc)}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground cursor-pointer"
              title="Mở / tải tài liệu"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
