import type { AttachedDocument } from '@pu/schemas'

// Cột cho thẻ tài liệu (alias d = documents, c = courses LEFT JOIN)
export const ATTACHED_DOCUMENT_COLUMNS = `d.id, d.title, d.file_url, d.file_size, d.mime_type, d.doc_type, d.course_id, d.academic_year,
  d.listed, d.status, d.visibility, d.download_count, c.code AS course_code, c.name AS course_name`

export function toAttachedDocument(row: any): AttachedDocument {
  return {
    id: row.id,
    title: row.title,
    fileUrl: row.file_url,
    fileSize: Number(row.file_size) || 0,
    mimeType: row.mime_type,
    docCategory: row.doc_type ?? null,
    courseId: row.course_id ?? null,
    courseCode: row.course_code ?? null,
    courseName: row.course_name ?? null,
    academicYear: row.academic_year ?? null,
    listed: !!row.listed,
    status: row.status,
    visibility: row.visibility === 'public' ? 'public' : 'private',
    downloadCount: row.download_count || 0
  }
}

// Định dạng tệp (cột documents.type) suy từ MIME
export function formatFromMime(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (/word/.test(mime)) return 'doc'
  if (/presentation|powerpoint/.test(mime)) return 'slides'
  if (/sheet|excel|csv/.test(mime)) return 'sheet'
  if (mime === 'text/markdown') return 'markdown'
  return 'other'
}
