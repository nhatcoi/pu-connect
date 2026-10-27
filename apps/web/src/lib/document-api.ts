import type {
  AttachedDocument,
  ClassifyDocumentInput,
  DocumentDetail,
  DocumentListPage,
  DocumentSuggestion,
  DocumentUploadResult,
  LibraryFolder,
  LibraryItem,
  LibraryPage,
  WriteDocumentPostInput,
  WriteDocumentPostResult
} from '@pu/schemas'
import { API_BASE_URL, apiClient } from './api-client'

type Envelope<T> = { data: T }

const qs = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// multipart (apiClient luôn gửi JSON)
async function postFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', credentials: 'include', body: formData })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.message || 'Không thể tải tệp lên máy chủ')
  }
  return ((await response.json()) as Envelope<T>).data
}

// Đính kèm khi soạn bài / bình luận: tải tệp lên + tạo bản nháp (chưa ai thấy cho tới khi đăng)
export function uploadDocumentDraft(file: File): Promise<DocumentUploadResult> {
  return postFile('/documents/upload', file)
}

export async function classifyDocument(id: string, input: ClassifyDocumentInput): Promise<AttachedDocument> {
  return (await apiClient<Envelope<AttachedDocument>>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(input) })).data
}

// N7AI đọc tệp, gợi ý môn / loại / năm học / tiêu đề (chưa lưu; 1 lượt N7AI)
export async function suggestDocument(id: string): Promise<DocumentSuggestion> {
  return (await apiClient<Envelope<DocumentSuggestion>>(`/documents/${id}/suggest`, { method: 'POST' })).data
}

// "Viết giúp": N7AI viết nội dung bài từ tài liệu đính kèm (giữ ý của bản nháp nếu có)
export async function writeDocumentPost(input: WriteDocumentPostInput): Promise<WriteDocumentPostResult> {
  return (await apiClient<Envelope<WriteDocumentPostResult>>('/documents/write-post', { method: 'POST', body: JSON.stringify(input) })).data
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

export async function deleteDocument(id: string): Promise<void> {
  await apiClient(`/documents/${id}`, { method: 'DELETE' })
}

// ── Trang Tài liệu & chi tiết ──
export type BrowseFilters = { course?: string; category?: string; q?: string; sort?: 'popular' | 'newest' }

export async function browseDocuments(filters: BrowseFilters, cursor?: string | null): Promise<DocumentListPage> {
  return (await apiClient<Envelope<DocumentListPage>>(`/documents/browse${qs({ ...filters, cursor: cursor ?? undefined })}`)).data
}

export async function getDocumentDetail(id: string): Promise<DocumentDetail> {
  return (await apiClient<Envelope<DocumentDetail>>(`/documents/${id}/detail`)).data
}

// ── Kho cá nhân ──
export type LibraryScope = 'saved' | 'mine'

export async function listLibrary(scope: LibraryScope, folder?: string, q?: string, cursor?: string | null): Promise<LibraryPage> {
  return (await apiClient<Envelope<LibraryPage>>(`/library${qs({ scope, folder, q, cursor: cursor ?? undefined })}`)).data
}

export async function librarySavedIds(): Promise<string[]> {
  return (await apiClient<Envelope<string[]>>('/library/ids')).data
}

export async function saveToLibrary(documentId: string, folderId?: string | null): Promise<LibraryItem> {
  return (await apiClient<Envelope<LibraryItem>>('/library', { method: 'POST', body: JSON.stringify({ documentId, folderId }) })).data
}

export async function removeFromLibrary(documentId: string): Promise<void> {
  await apiClient(`/library/${documentId}`, { method: 'DELETE' })
}

export async function moveLibraryItem(documentId: string, folderId: string | null): Promise<LibraryItem> {
  return (await apiClient<Envelope<LibraryItem>>(`/library/${documentId}`, { method: 'PATCH', body: JSON.stringify({ folderId }) })).data
}

// Tệp riêng tải thẳng vào kho (riêng tư)
export function uploadToLibrary(file: File, folderId?: string): Promise<{ item: LibraryItem; duplicateOf: DocumentUploadResult['duplicateOf'] }> {
  return postFile(`/library/upload${qs({ folder: folderId })}`, file)
}

export async function listLibraryFolders(): Promise<LibraryFolder[]> {
  return (await apiClient<Envelope<LibraryFolder[]>>('/library/folders')).data
}

export async function createLibraryFolder(name: string): Promise<LibraryFolder> {
  return (await apiClient<Envelope<LibraryFolder>>('/library/folders', { method: 'POST', body: JSON.stringify({ name }) })).data
}

export async function renameLibraryFolder(id: string, name: string): Promise<void> {
  await apiClient(`/library/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export async function deleteLibraryFolder(id: string): Promise<void> {
  await apiClient(`/library/folders/${id}`, { method: 'DELETE' })
}
