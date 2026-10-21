import { Globe, FileText, StickyNote, Youtube, type LucideIcon } from 'lucide-react'
import type { AiSource, AiSourceKind, ChatAttachment } from '@pu/schemas'
import { fileSize } from '@/components/chat/utils'

export const KIND_ICON: Record<AiSourceKind, LucideIcon> = { file: FileText, text: StickyNote, url: Globe, youtube: Youtube }

// Một tài liệu trong danh sách: tệp đã gửi trong tin nhắn (attachment) hoặc tài liệu đã thêm (source)
export interface DocEntry {
  id: string
  kind: AiSourceKind
  title: string
  subtitle: string
  attachment: ChatAttachment | null
  source: AiSource | null
}

const host = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : ''
  } catch {
    return ''
  }
}

export const entryFromAttachment = (a: ChatAttachment): DocEntry => ({ id: `file:${a.key}`, kind: 'file', title: a.name, subtitle: fileSize(a.size), attachment: a, source: null })

export function entryFromSource(s: AiSource): DocEntry {
  const subtitle = s.attachment ? fileSize(s.attachment.size) : s.kind === 'text' ? `Văn bản · ${(s.chars ?? 0).toLocaleString('vi-VN')} ký tự` : s.kind === 'youtube' ? 'YouTube' : host(s.url)
  return { id: s.attachment ? `file:${s.attachment.key}` : `source:${s.id}`, kind: s.kind, title: s.title, subtitle, attachment: s.attachment, source: s }
}

// Tài liệu đã thêm đứng trước; tệp cùng key chỉ hiện một lần (bản đã thêm, xóa được)
export function mergeEntries(sources: AiSource[], attachments: ChatAttachment[]): DocEntry[] {
  const added = sources.map(entryFromSource)
  const seen = new Set(added.map((e) => e.id))
  return [...added, ...attachments.map(entryFromAttachment).filter((e) => !seen.has(e.id))]
}
