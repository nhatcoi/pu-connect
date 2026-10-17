import { FileText, GraduationCap, MessageSquare, MessagesSquare, type LucideIcon } from 'lucide-react'
import type { ChatRef, ChatRefType } from '@pu/schemas'
import { n7aiThreadHref } from '@/lib/n7ai-routes'

// Ngữ cảnh gắn vào tin: biểu tượng, nhãn, đường dẫn (dùng chung chip ô soạn, menu gợi ý, bong bóng tin)
export const REF_META: Record<ChatRefType, { icon: LucideIcon; label: string }> = {
  course: { icon: GraduationCap, label: 'Học phần' },
  document: { icon: FileText, label: 'Tài liệu' },
  post: { icon: MessageSquare, label: 'Bài viết' },
  thread: { icon: MessagesSquare, label: 'Hội thoại N7AI' }
}

export function refHref(ref: Pick<ChatRef, 'type' | 'id' | 'title' | 'code'>): string {
  switch (ref.type) {
    case 'course':
      return ref.code ? `/courses/${ref.code}` : `/search?q=${encodeURIComponent(ref.title)}&type=courses`
    case 'post':
      return `/post/${ref.id}`
    case 'thread':
      return n7aiThreadHref(ref.id)
    default:
      return `/search?q=${encodeURIComponent(ref.title)}&type=documents`
  }
}
