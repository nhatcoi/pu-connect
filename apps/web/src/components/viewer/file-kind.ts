import type { ChatAttachment } from '@pu/schemas'

export type PreviewFile = Pick<ChatAttachment, 'url' | 'name' | 'size' | 'mime'>

export type PreviewKind = 'pdf' | 'docx' | 'pptx' | 'sheet' | 'csv' | 'markdown' | 'code' | 'image' | 'video' | 'audio' | 'office' | 'none'

// Định dạng Office cũ (nhị phân) chưa có trình xem trong app ⇒ dùng Office Online
const LEGACY_OFFICE = /^(doc|ppt|xls|odt|odp|ods|rtf)$/
const CODE = /^(txt|log|tex|json|xml|ya?ml|py|ipynb|js|jsx|ts|tsx|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|sql|sh|r|kt|swift|html?|css)$/

export const fileExtension = (name: string) => (name.split('.').pop() || '').toLowerCase()

// Loại xem trước theo đuôi tệp (đáng tin hơn MIME: trình duyệt hay gửi MIME rỗng cho mã nguồn)
export function previewKind(file: PreviewFile): PreviewKind {
  const ext = fileExtension(file.name)
  const mime = file.mime || ''
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (ext === 'docx') return 'docx'
  if (ext === 'pptx') return 'pptx'
  if (ext === 'xlsx') return 'sheet'
  if (ext === 'csv' || ext === 'tsv') return 'csv'
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (LEGACY_OFFICE.test(ext)) return 'office'
  if (CODE.test(ext) || mime.startsWith('text/')) return 'code'
  return 'none'
}

export const KIND_LABEL: Record<PreviewKind, string> = {
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'Slide',
  sheet: 'Bảng tính',
  csv: 'Bảng dữ liệu',
  markdown: 'Ghi chú',
  code: 'Văn bản · mã nguồn',
  image: 'Ảnh',
  video: 'Video',
  audio: 'Âm thanh',
  office: 'Office',
  none: 'Tệp'
}
