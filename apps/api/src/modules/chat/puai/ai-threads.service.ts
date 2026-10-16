import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiThread, AiThreadsPage } from '@pu/schemas'
import { ChatCoreService } from '../chat-core.service'
import type { ListAiThreadsQuery } from '../dto/chat.dto'

// Khóa sắp xếp = hoạt động gần nhất (khớp index idx_conversations_ai_threads)
const SORT_AT = `COALESCE(c.last_message_at, c.created_at)`
// Giữ micro giây ⇒ không sót / lặp hàng khi phân trang (JS Date chỉ có mili giây)
const SORT_AT_TEXT = `to_char(${SORT_AT} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

type Cursor = { sortAt: string; id: string }
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify([c.sortAt, c.id])).toString('base64url')
function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null
  try {
    const [sortAt, id] = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (typeof sortAt === 'string' && !Number.isNaN(Date.parse(sortAt)) && typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) return { sortAt, id }
  } catch {
    // rơi xuống lỗi bên dưới
  }
  throw new BadRequestException('cursor không hợp lệ')
}

export const mapThread = (r: any): AiThread => ({
  id: r.id,
  title: r.title,
  lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
  createdAt: new Date(r.created_at).toISOString()
})

// Lịch sử hội thoại PU AI: danh sách nhẹ (keyset), tìm theo tiêu đề, đổi tên, xóa
// Tạo thread mới nằm ở ConversationsService (nơi sở hữu việc tạo mọi loại hội thoại)
@Injectable()
export class AiThreadsService {
  constructor(private readonly core: ChatCoreService) {}

  async list(userId: string, query: ListAiThreadsQuery): Promise<AiThreadsPage> {
    const params: unknown[] = [userId, query.limit + 1]
    const where = [`c.type = 'ai'`, `c.created_by = $1`, `c.last_message_id IS NOT NULL`]
    const term = query.q?.trim().toLowerCase()
    if (term) {
      params.push(term.replace(/[%_\\]/g, (ch) => `\\${ch}`))
      where.push(`immutable_unaccent(lower(c.title)) LIKE '%' || immutable_unaccent($${params.length}) || '%'`)
    }
    const cursor = decodeCursor(query.cursor)
    if (cursor) {
      params.push(cursor.sortAt, cursor.id)
      where.push(`(${SORT_AT}, c.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`)
    }
    const res = await this.core.db.query(
      `SELECT c.id, c.title, c.last_message_at, c.created_at, ${SORT_AT_TEXT} AS sort_at
       FROM conversations c WHERE ${where.join(' AND ')}
       ORDER BY ${SORT_AT} DESC, c.id DESC LIMIT $2`,
      params
    )
    const rows = res.rows.slice(0, query.limit)
    const last = rows[rows.length - 1]
    return {
      data: rows.map(mapThread),
      nextCursor: res.rows.length > query.limit ? encodeCursor({ sortAt: last.sort_at, id: last.id }) : null
    }
  }

  // Đổi tên ⇒ đồng bộ các tab khác của mình
  async rename(userId: string, id: string, title: string): Promise<AiThread> {
    const res = await this.core.db.query(
      `UPDATE conversations SET title = $3 WHERE id = $1 AND type = 'ai' AND created_by = $2
       RETURNING id, title, last_message_at, created_at`,
      [id, userId, title]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy hội thoại')
    const thread = mapThread(res.rows[0])
    this.core.emitTo([userId], 'ai.thread.updated', thread)
    return thread
  }

  // Xóa hẳn (cascade tin, thành viên, mention); tab khác nhận conv.removed
  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.core.db.query(`DELETE FROM conversations WHERE id = $1 AND type = 'ai' AND created_by = $2 RETURNING id`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy hội thoại')
    this.core.emitTo([userId], 'conv.removed', { conversationId: id })
    return { deleted: true }
  }
}

// Tiêu đề tự đặt từ câu hỏi đầu (dòng đầu, gọn khoảng trắng, ≤ 60 ký tự)
// Chỉ có tệp ⇒ null (tin sau sẽ đặt tiêu đề)
export function deriveThreadTitle(content: string): string | null {
  const line = content.replace(/@puai\b/gi, '').split('\n').find((l) => l.trim())?.replace(/\s+/g, ' ').trim()
  if (!line) return null
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line
}
