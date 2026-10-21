import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiThread, AiThreadsPage } from '@pu/schemas'
import { markdownToPlainText } from '../../notifications/notification.types'
import { StorageService } from '../../storage/storage.service'
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

// Cột cho mapThread (RETURNING / SELECT)
export const THREAD_COLUMNS = 'id, title, ai_folder_id, last_message_at, created_at'

export const mapThread = (r: any): AiThread => ({
  id: r.id,
  title: r.title,
  folderId: r.ai_folder_id ?? null,
  lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
  createdAt: new Date(r.created_at).toISOString()
})

// Lịch sử hội thoại N7AI: danh sách nhẹ (keyset), lọc theo thư mục, tìm, đổi tên, chuyển thư mục, xóa
// Tạo thread mới nằm ở ConversationsService (nơi sở hữu việc tạo mọi loại hội thoại)
@Injectable()
export class AiThreadsService {
  constructor(
    private readonly core: ChatCoreService,
    private readonly storage: StorageService
  ) {}

  async list(userId: string, query: ListAiThreadsQuery): Promise<AiThreadsPage> {
    const params: unknown[] = [userId, query.limit + 1]
    const where = [`c.type = 'ai'`, `c.created_by = $1`, `c.last_message_id IS NOT NULL`]
    if (query.folder === 'root') where.push(`c.ai_folder_id IS NULL`)
    else if (query.folder !== 'all') {
      params.push(query.folder)
      where.push(`c.ai_folder_id = $${params.length}`)
    }
    const term = query.q?.trim().toLowerCase()
    if (term) {
      params.push(term.replace(/[%_\\]/g, (ch) => `\\${ch}`))
      // Tiêu đề (trgm) hoặc nội dung tin — chỉ quét tin trong thread của chính mình (idx_messages_conv)
      const like = `LIKE '%' || immutable_unaccent($${params.length}) || '%'`
      where.push(`(immutable_unaccent(lower(c.title)) ${like}
        OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL AND m.kind <> 'system'
                   AND immutable_unaccent(lower(m.content)) ${like}))`)
    }
    const cursor = decodeCursor(query.cursor)
    if (cursor) {
      params.push(cursor.sortAt, cursor.id)
      where.push(`(${SORT_AT}, c.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`)
    }
    const res = await this.core.db.query(
      `SELECT c.id, c.title, c.ai_folder_id, c.last_message_at, c.created_at, ${SORT_AT_TEXT} AS sort_at
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

  // Đổi tên
  async rename(userId: string, id: string, title: string): Promise<AiThread> {
    const res = await this.core.db.query(
      `UPDATE conversations SET title = $3 WHERE id = $1 AND type = 'ai' AND created_by = $2
       RETURNING ${THREAD_COLUMNS}`,
      [id, userId, title]
    )
    return this.updated(userId, res.rows[0])
  }

  // Chuyển vào thư mục (null ⇒ về Lịch sử); thư mục phải là của mình
  async move(userId: string, id: string, folderId: string | null): Promise<AiThread> {
    const res = await this.core.db.query(
      `UPDATE conversations c SET ai_folder_id = $3
       WHERE c.id = $1 AND c.type = 'ai' AND c.created_by = $2
         AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM ai_folders f WHERE f.id = $3 AND f.user_id = $2))
       RETURNING ${THREAD_COLUMNS}`,
      [id, userId, folderId]
    )
    return this.updated(userId, res.rows[0])
  }

  // Thread vừa sửa ⇒ đồng bộ các tab khác của mình
  private updated(userId: string, row: unknown): AiThread {
    if (!row) throw new NotFoundException('Không tìm thấy hội thoại hoặc thư mục')
    const thread = mapThread(row)
    this.core.emitTo([userId], 'ai.thread.updated', thread)
    return thread
  }

  // Xóa hẳn; tab khác nhận conv.removed
  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    // Cùng snapshot: lấy key tệp đính kèm rồi xóa hội thoại (cascade tin, thành viên, mention)
    const res = await this.core.db.query(
      `WITH files AS (
         SELECT a->>'key' AS key FROM messages m CROSS JOIN LATERAL jsonb_array_elements(m.attachments) a
         WHERE m.conversation_id = $1 AND m.attachments IS NOT NULL
       ), del AS (
         DELETE FROM conversations WHERE id = $1 AND type = 'ai' AND created_by = $2 RETURNING id
       )
       SELECT (SELECT id FROM del) AS id, (SELECT array_agg(key) FROM files) AS keys`,
      [id, userId]
    )
    if (!res.rows[0]?.id) throw new NotFoundException('Không tìm thấy hội thoại')
    // Chỉ xóa tệp do chính mình tải lên chat/{userId}/ (sau commit, không chặn phản hồi)
    const keys = ((res.rows[0].keys as string[] | null) ?? []).filter((k) => this.storage.isOwnedKey(k, 'chat', userId))
    if (keys.length) void this.storage.deleteObjects(keys)
    this.core.emitTo([userId], 'conv.removed', { conversationId: id })
    return { deleted: true }
  }
}

// Tiêu đề tự đặt từ câu hỏi đầu (dòng đầu, bỏ ký hiệu Markdown, ≤ 60 ký tự)
// Chỉ có tệp ⇒ null (tin sau sẽ đặt tiêu đề)
export function deriveThreadTitle(content: string): string | null {
  const firstLine = content
    .replace(/@(?:n7ai|puai)\b/gi, '')
    .split('\n')
    .find((l) => l.trim())
  const line = firstLine ? markdownToPlainText(firstLine) : ''
  if (!line) return null
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line
}
