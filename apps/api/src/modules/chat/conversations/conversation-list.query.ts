import { BadRequestException } from '@nestjs/common'
import type { ConversationFilter } from '@pu/schemas'

// Thứ tự danh sách: N7AI chat nhanh → hội thoại đã ghim (theo lúc ghim) → còn lại (theo tin mới nhất)
// Khóa keyset (rank, sort_at, id) giảm dần ⇒ so sánh tuple "<" để lấy trang sau
export const LIST_RANK = `CASE WHEN c.type = 'ai' THEN 2 WHEN me.pinned_at IS NOT NULL THEN 1 ELSE 0 END`
export const LIST_SORT_AT = `CASE WHEN c.type <> 'ai' AND me.pinned_at IS NOT NULL THEN me.pinned_at ELSE COALESCE(c.last_message_at, c.created_at) END`

// Thread N7AI gần nhất: có tin trước, rồi hoạt động gần nhất ($1 = người xem)
export const LATEST_AI_SQL = `SELECT a.id FROM conversations a WHERE a.type = 'ai' AND a.created_by = $1
  ORDER BY (a.last_message_id IS NULL), COALESCE(a.last_message_at, a.created_at) DESC, a.id DESC LIMIT 1`

// Tin nhắn chỉ giữ 1 thread N7AI "chat nhanh" = thread gần nhất (subquery không tương quan ⇒ InitPlan chạy 1 lần)
export const LATEST_AI_ONLY = `(c.type <> 'ai' OR c.id = (${LATEST_AI_SQL}))`

// Badge chưa đọc không gồm thread N7AI (câu trả lời cho chính câu mình hỏi)
export const NOT_AI = `c.type <> 'ai'`

// Lọc ở server ⇒ phân trang đúng cả khi lọc (alias me = thành viên là mình, c = hội thoại)
export const LIST_FILTERS: Record<ConversationFilter, string> = {
  all: '',
  group: `AND c.type = 'group'`,
  unread: `AND EXISTS (SELECT 1 FROM messages um
                       WHERE um.conversation_id = c.id AND um.id > me.last_read_message_id
                         AND um.deleted_at IS NULL AND um.kind <> 'system' AND um.sender_id IS DISTINCT FROM me.user_id)`
}

export type ListCursor = { rank: number; sortAt: string; id: string }

// sort_at giữ độ chính xác micro giây (JS Date chỉ có mili giây ⇒ có thể bỏ sót / lặp hàng)
export const SORT_AT_TEXT = `to_char(k.sort_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

export function encodeCursor(c: ListCursor): string {
  return Buffer.from(JSON.stringify([c.rank, c.sortAt, c.id])).toString('base64url')
}

export function decodeCursor(raw: string | undefined): ListCursor | null {
  if (!raw) return null
  try {
    const [rank, sortAt, id] = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    const valid =
      [0, 1, 2].includes(rank) && typeof sortAt === 'string' && !Number.isNaN(Date.parse(sortAt)) && typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
    if (valid) return { rank, sortAt, id }
  } catch {
    // rơi xuống lỗi bên dưới
  }
  throw new BadRequestException('cursor không hợp lệ')
}
