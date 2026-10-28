import { FileText, Globe, Image as ImageIcon, Layers, ListChecks, StickyNote, Youtube, type LucideIcon } from 'lucide-react'
import type { AiLibraryItem, AiSource, ChatAttachment } from '@pu/schemas'
import { splitStudyBlocks, type FlashcardData, type QuizData } from '@/components/chat/ai/study-blocks'
import { entryFromAttachment, entryFromSource, type DocEntry } from '@/components/n7ai/sources/doc-entries'
import { fileSize } from '@/components/chat/utils'

// Thư viện N7AI gom mọi thứ về một danh sách: tài liệu đã thêm, tệp / ảnh đã gửi trong chat, học liệu do N7AI tạo
export type LibKind = 'document' | 'image' | 'link' | 'video' | 'note' | 'study'
export type LibFilter = 'all' | LibKind
export type StudyBlock = { kind: 'quiz'; data: QuizData } | { kind: 'flashcards'; data: FlashcardData }

export interface LibEntry {
  id: string
  kind: LibKind
  title: string
  subtitle: string
  at: string // ISO, để sắp xếp và hiện "x ngày trước"
  thumb: string | null // ảnh xem trước (ảnh)
  doc: DocEntry | null // mở bằng trình xem tệp / chữ
  source: AiSource | null // đã thêm trực tiếp vào thư viện (gỡ, lưu vào Kho được)
  thread: { id: string; title: string | null; messageId: string } | null
  study: StudyBlock | null
}

export const KIND_META: Record<LibKind, { label: string; plural: string; icon: LucideIcon }> = {
  document: { label: 'Tài liệu', plural: 'Tài liệu', icon: FileText },
  image: { label: 'Ảnh', plural: 'Ảnh', icon: ImageIcon },
  link: { label: 'Liên kết', plural: 'Liên kết', icon: Globe },
  video: { label: 'Video', plural: 'Video', icon: Youtube },
  note: { label: 'Ghi chú', plural: 'Ghi chú', icon: StickyNote },
  study: { label: 'Học liệu', plural: 'Học liệu', icon: ListChecks }
}
export const FILTERS: LibFilter[] = ['all', 'document', 'image', 'link', 'video', 'note', 'study']
export const STUDY_ICON = { quiz: ListChecks, flashcards: Layers }

const isImage = (mime: string | undefined) => !!mime?.startsWith('image/')
const threadOf = (item: AiLibraryItem) => ({ id: item.threadId, title: item.threadTitle, messageId: item.messageId })

function fromSource(s: AiSource): LibEntry {
  const doc = entryFromSource(s)
  const image = s.attachment ? isImage(s.attachment.mime) : false
  const kind: LibKind = s.kind === 'file' ? (image ? 'image' : 'document') : s.kind === 'text' ? 'note' : s.kind === 'url' ? 'link' : 'video'
  return { id: `source:${s.id}`, kind, title: s.title, subtitle: doc.subtitle, at: s.createdAt, thumb: image ? s.attachment!.url : null, doc, source: s, thread: null, study: null }
}

function fromAttachment(a: ChatAttachment, item: AiLibraryItem): LibEntry {
  const image = a.kind === 'image' || isImage(a.mime)
  return {
    id: `file:${a.key}`,
    kind: image ? 'image' : 'document',
    title: a.name,
    subtitle: fileSize(a.size),
    at: item.createdAt,
    thumb: image ? a.url : null,
    doc: entryFromAttachment(a),
    source: null,
    thread: threadOf(item),
    study: null
  }
}

function fromStudy(item: AiLibraryItem): LibEntry[] {
  return splitStudyBlocks(item.content ?? '').flatMap((s, i): LibEntry[] => {
    if (s.type !== 'quiz' && s.type !== 'flashcards') return []
    const block = { kind: s.type, data: s.data } as StudyBlock
    const count = block.kind === 'quiz' ? `${block.data.questions.length} câu hỏi` : `${block.data.cards.length} thẻ`
    const label = block.kind === 'quiz' ? 'Quiz' : 'Flashcard'
    return [{ id: `study:${item.messageId}-${i}`, kind: 'study', title: block.data.title || item.threadTitle || label, subtitle: `${label} · ${count}`, at: item.createdAt, thumb: null, doc: null, source: null, thread: threadOf(item), study: block }]
  })
}

// Gộp, bỏ tệp trùng (đã thêm vào thư viện thì không hiện lại ở tệp đã gửi), mới nhất trước
export function buildEntries(sources: AiSource[], files: AiLibraryItem[], images: AiLibraryItem[], study: AiLibraryItem[]): LibEntry[] {
  const added = sources.map(fromSource)
  const seen = new Set(added.map((e) => e.id))
  const sent = [...files, ...images].flatMap((item) => item.attachments.map((a) => fromAttachment(a, item))).filter((e) => !seen.has(e.id) && seen.add(e.id))
  return [...added, ...sent, ...study.flatMap(fromStudy)].sort((a, b) => b.at.localeCompare(a.at))
}

export const matches = (e: LibEntry, filter: LibFilter, query: string) =>
  (filter === 'all' || e.kind === filter) && (!query || e.title.toLowerCase().includes(query))
