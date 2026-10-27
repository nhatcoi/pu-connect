'use client'

import React from 'react'
import Link from 'next/link'
import type { AttachedDocument } from '@pu/schemas'
import { Bookmark, Download, Lock } from 'lucide-react'
import { openDocument } from '@/lib/document-api'
import { docExt, docMetaLine } from './document-format'
import { SaveDocumentButton } from './save-document-button'

interface DocumentRowProps {
  document: AttachedDocument & { ownerName?: string; saveCount?: number }
  // Dòng phụ thêm (người đăng, tài liệu riêng tư…)
  subtitle?: React.ReactNode
  // Nút thao tác riêng (kho cá nhân: chuyển thư mục / bỏ lưu); mặc định nút Lưu
  actions?: React.ReactNode
  privateBadge?: boolean
}

// Một dòng tài liệu: trang Tài liệu, tài liệu liên quan, kho cá nhân. Bấm tên ⇒ trang chi tiết
export function DocumentRow({ document: doc, subtitle, actions, privateBadge }: DocumentRowProps) {
  const meta = docMetaLine(doc)
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-xs transition-colors hover:bg-muted/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">{docExt(doc)}</span>
      <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1 group">
        <p className="truncate text-[13px] font-semibold text-foreground group-hover:text-primary">{doc.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
          {doc.courseCode && <span className="font-mono font-semibold text-primary">{doc.courseCode}</span>}
          {meta && <span>{meta}</span>}
          {privateBadge && (
            <span className="inline-flex items-center gap-0.5">
              <Lock className="h-3 w-3" /> Riêng tư
            </span>
          )}
        </p>
        {(subtitle || doc.ownerName) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            {subtitle ?? <span>{doc.ownerName}</span>}
            {doc.downloadCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Download className="h-3 w-3" /> {doc.downloadCount}
              </span>
            )}
            {!!doc.saveCount && (
              <span className="inline-flex items-center gap-0.5">
                <Bookmark className="h-3 w-3" /> {doc.saveCount}
              </span>
            )}
          </p>
        )}
      </Link>
      {actions ?? <SaveDocumentButton documentId={doc.id} />}
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
}
