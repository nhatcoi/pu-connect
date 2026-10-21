import type { ChatAttachment } from '@pu/schemas'
import { API_BASE_URL } from '@/lib/api-client'

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

// Đuôi tệp nhận khi chọn / thả (khớp danh sách API cho phép; mã nguồn nhận theo đuôi)
const DOCUMENT_EXT = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'tsv']
const CODE_EXT = ['py', 'java', 'c', 'cc', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'yml', 'yaml', 'tex']
// N7AI đọc được nội dung các loại này (Office cũ .doc .ppt .xls chỉ xem, chưa đọc)
const LEARNABLE_EXT = ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md', 'csv', 'tsv', ...CODE_EXT]

const ALLOWED_EXT = [...DOCUMENT_EXT, 'zip', 'rar', ...CODE_EXT]
const accept = (exts: string[]) => ['image/*', ...exts.map((e) => `.${e}`)].join(',')
export const ATTACHMENT_ACCEPT = accept(ALLOWED_EXT)
export const SOURCE_ACCEPT = accept(LEARNABLE_EXT)

const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase()
const isImage = (file: File) => file.type.startsWith('image/')

// Lý do không nhận tệp (null = hợp lệ); API vẫn kiểm lại, đây để báo lỗi ngay không cần tải lên
export function attachmentError(file: File): string | null {
  if (file.size === 0) return `${file.name} không có nội dung`
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} lớn hơn 25 MB`
  if (!isImage(file) && !ALLOWED_EXT.includes(extOf(file.name))) return `${file.name}: định dạng chưa được hỗ trợ`
  return null
}

// Tài liệu học: thêm điều kiện N7AI phải đọc được nội dung
export function sourceError(file: File): string | null {
  const general = attachmentError(file)
  if (general) return general
  return isImage(file) || LEARNABLE_EXT.includes(extOf(file.name)) ? null : `${file.name}: N7AI chưa đọc được định dạng này (dùng PDF, Word, PowerPoint, Excel, văn bản hoặc ảnh)`
}

// Tải 1 tệp lên R2 (thư mục chat/) qua XHR để có tiến trình
export function uploadChatFile(file: File, onProgress: (percent: number) => void): { promise: Promise<ChatAttachment>; abort: () => void } {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<ChatAttachment>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    xhr.open('POST', `${API_BASE_URL}/upload/file?folder=chat`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText)
        if (xhr.status >= 300) return reject(new Error(body?.message || 'Tải tệp thất bại'))
        const d = body.data
        resolve({ url: d.url, key: d.key, size: d.size, name: file.name, mime: file.type || 'application/octet-stream', kind: isImage(file) ? 'image' : 'file' })
      } catch {
        reject(new Error('Tải tệp thất bại'))
      }
    }
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải tệp'))
    xhr.send(form)
  })
  return { promise, abort: () => xhr.abort() }
}
