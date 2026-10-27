import type { AttachedDocument, ClassifyDocumentInput, DocumentUploadResult } from '@pu/schemas'
import { API_BASE_URL, apiClient } from './api-client'

type Envelope<T> = { data: T }

// Đính kèm khi soạn bài: tải tệp lên + tạo bản nháp (chưa ai thấy cho tới khi đăng bài)
export async function uploadDocumentDraft(file: File): Promise<DocumentUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE_URL}/documents/upload`, { method: 'POST', credentials: 'include', body: formData })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.message || 'Không thể tải tệp lên máy chủ')
  }
  return ((await response.json()) as Envelope<DocumentUploadResult>).data
}

export async function classifyDocument(id: string, input: ClassifyDocumentInput): Promise<AttachedDocument> {
  return (await apiClient<Envelope<AttachedDocument>>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(input) })).data
}

export async function discardDocumentDraft(id: string): Promise<void> {
  await apiClient(`/documents/${id}/draft`, { method: 'DELETE' })
}

// Mở / tải tài liệu: đếm lượt tải rồi mở tệp ở tab mới (lỗi đếm không chặn việc mở)
export async function openDocument(doc: Pick<AttachedDocument, 'id' | 'fileUrl'>): Promise<void> {
  const win = window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')
  await apiClient(`/documents/${doc.id}/download`, { method: 'POST' }).catch(() => undefined)
  if (!win) window.location.href = doc.fileUrl
}
