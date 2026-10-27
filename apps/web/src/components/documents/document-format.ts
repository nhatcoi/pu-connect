import type { AttachedDocument } from '@pu/schemas'
import { DOC_CATEGORY_LABELS } from '@pu/schemas'

export function formatDocSize(bytes: number) {
  if (!bytes) return null
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// "Đề cuối kỳ · 2024-2025 · 1.2 MB"
export function docMetaLine(doc: Pick<AttachedDocument, 'docCategory' | 'academicYear' | 'fileSize'>) {
  return [doc.docCategory && DOC_CATEGORY_LABELS[doc.docCategory], doc.academicYear, formatDocSize(doc.fileSize)].filter(Boolean).join(' · ')
}

// Nhãn định dạng tệp trên ô biểu tượng (PDF, DOCX…)
export function docExt(doc: Pick<AttachedDocument, 'fileUrl' | 'title'>) {
  const ext = (doc.fileUrl.split('?')[0].split('.').pop() || '').toUpperCase()
  return ext.length <= 4 ? ext : 'FILE'
}
