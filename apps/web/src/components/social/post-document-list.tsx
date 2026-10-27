'use client'

import React from 'react'
import Link from 'next/link'
import { DOC_CATEGORY_LABELS, type AttachedDocument } from '@pu/schemas'
import { Download, FileText, Library } from 'lucide-react'
import { openDocument } from '@/lib/document-api'

function formatSize(bytes: number) {
  if (!bytes) return null
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Tài liệu đính kèm bài viết: loại, môn, đã vào kho môn học; bấm để mở (đếm lượt tải)
export function PostDocumentList({ documents }: { documents: AttachedDocument[] }) {
  if (!documents.length) return null
  return (
    <div className="space-y-1.5">
      {documents.map((doc) => {
        const meta = [doc.docCategory && DOC_CATEGORY_LABELS[doc.docCategory], doc.academicYear, formatSize(doc.fileSize)].filter(Boolean).join(' · ')
        return (
          <div key={doc.id} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <button type="button" onClick={() => void openDocument(doc)} className="min-w-0 flex-1 text-left cursor-pointer group">
              <p className="truncate font-semibold text-foreground group-hover:text-primary group-hover:underline">{doc.title}</p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                {meta && <span>{meta}</span>}
                {doc.listed && (
                  <span className="inline-flex items-center gap-0.5 text-primary">
                    <Library className="h-3 w-3" /> Kho môn học
                  </span>
                )}
              </p>
            </button>
            {doc.courseCode && (
              <Link
                href={`/courses/${encodeURIComponent(doc.courseCode)}`}
                className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary hover:bg-primary/15"
              >
                {doc.courseCode}
              </Link>
            )}
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
