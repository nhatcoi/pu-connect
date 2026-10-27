'use client'

import React from 'react'
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type ClassifyDocumentInput, type Course, type DocCategory } from '@pu/schemas'
import { AlertTriangle, FileText, Library, Loader2, Sparkles, X } from 'lucide-react'
import { CourseSelect } from '@/components/documents/course-select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { AttachedFile } from './composer-attachment-preview'

interface ComposerDocumentCardProps {
  file: AttachedFile
  courses: Course[]
  // Intent "Đề thi & Slide": bắt buộc chọn môn + loại
  required: boolean
  onClassify: (file: AttachedFile, patch: ClassifyDocumentInput) => void
  onUseDuplicate: (file: AttachedFile) => void
  onSuggest: (file: AttachedFile) => void
  onRemove: (id: string) => void
}

// Năm học gần đây (mới nhất trước), vd "2025-2026"
const ACADEMIC_YEARS = (() => {
  const now = new Date()
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 6 }, (_, i) => `${start - i}-${start - i + 1}`)
})()

const SELECT = 'h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50'

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Thẻ tệp đính kèm: tải lên ngay, người đăng phân loại (môn, loại, năm học) để đưa vào kho môn học
export function ComposerDocumentCard({ file, courses, required, onClassify, onUseDuplicate, onSuggest, onRemove }: ComposerDocumentCardProps) {
  const doc = file.doc
  const ready = !!doc && !file.uploading
  const classified = !!doc?.courseId && !!doc?.docCategory
  const missing = required && ready && !classified

  return (
    <div className={cn('w-full rounded-xl border bg-muted/30 p-2.5 text-xs text-foreground', missing ? 'border-amber-500/50' : 'border-border')}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          {file.uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold leading-tight" title={file.name}>
            {doc?.title || file.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatSize(file.size)}
            {file.uploading && ' · Đang tải lên...'}
            {file.error && <span className="text-destructive"> · {file.error}</span>}
            {doc?.listed && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-primary">
                · <Library className="h-3 w-3" /> Vào kho môn học
              </span>
            )}
          </p>
        </div>
        {ready && !file.reused && (
          <button
            type="button"
            onClick={() => onSuggest(file)}
            disabled={file.suggesting}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60 cursor-pointer"
            title="N7AI đọc tệp và điền môn, loại, năm học, tiêu đề"
          >
            {file.suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            N7AI gợi ý
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground cursor-pointer"
          title="Gỡ tệp"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {ready && file.reused && <p className="mt-1.5 text-[11px] text-muted-foreground">Dùng tài liệu có sẵn trong kho (giữ phân loại của người đăng gốc)</p>}

      {ready && !file.reused && (
        <>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <CourseSelect
              courses={courses}
              value={doc.courseId ?? ''}
              onChange={(v) => onClassify(file, { courseId: v || null })}
              placeholder={required ? 'Chọn môn học *' : 'Môn học'}
              className="text-[11px]"
            />
            <select
              aria-label="Loại tài liệu"
              value={doc.docCategory ?? ''}
              onChange={(e) => onClassify(file, { docCategory: (e.target.value || null) as DocCategory | null })}
              className={SELECT}
            >
              <option value="">{required ? 'Loại tài liệu *' : 'Loại tài liệu'}</option>
              {DOC_CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {DOC_CATEGORY_LABELS[k]}
                </option>
              ))}
            </select>
            <select
              aria-label="Năm học"
              value={doc.academicYear ?? ''}
              onChange={(e) => onClassify(file, { academicYear: e.target.value || null })}
              className={SELECT}
            >
              <option value="">Năm học (tùy chọn)</option>
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className={cn(classified ? 'text-foreground' : 'text-muted-foreground')}>
              Đưa vào kho môn học {!classified && '(chọn môn + loại)'}
            </span>
            <Switch checked={doc.listed} disabled={!classified} onCheckedChange={(v: boolean) => onClassify(file, { listed: v })} />
          </label>

          {file.duplicateOf && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                Đã có trong kho: {file.duplicateOf.title}
                {file.duplicateOf.courseCode && ` (${file.duplicateOf.courseCode})`}
              </span>
              <button type="button" onClick={() => onUseDuplicate(file)} className="shrink-0 font-semibold underline cursor-pointer">
                Dùng bản đó
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
