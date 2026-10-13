import type { UiMessage } from '@/hooks/chat'

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

// Nhãn ngày cho vạch phân cách: Hôm nay / Hôm qua / Thứ… dd/mm
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Hôm qua'
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()

// Gộp tin liên tiếp cùng người trong 5 phút (ẩn tên/ảnh đại diện lặp lại)
export function isContinuation(prev: UiMessage | undefined, cur: UiMessage): boolean {
  if (!prev || prev.kind === 'system' || cur.kind === 'system') return false
  if (prev.sender?.id !== cur.sender?.id) return false
  return new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Đuôi tệp in hoa cho thẻ tệp (PDF, DOCX…)
export const fileExt = (name: string) => (name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()

// Xem trước 1 dòng cho danh sách / trích dẫn
export function messagePreview(m: { content: string; attachments: { kind: string }[] | null; deleted: boolean }): string {
  if (m.deleted) return 'Tin nhắn đã thu hồi'
  if (m.content) return m.content.replace(/```[\s\S]*?```/g, '[nội dung]').replace(/\s+/g, ' ').trim()
  const n = m.attachments?.length ?? 0
  if (!n) return '…'
  return m.attachments!.every((a) => a.kind === 'image') ? `📷 ${n} ảnh` : `📎 ${n} tệp`
}
