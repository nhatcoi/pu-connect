import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AI_NOTE_CONTENT_MAX, AI_NOTE_LIMIT, type AiNote, type AiNoteCreateInput, type AiNoteSummary, type AiNoteUpdateInput } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'

const SUMMARY_COLS = 'id, parent_id, conversation_id, title, pinned, position, updated_at'

const mapSummary = (r: any): AiNoteSummary => ({
  id: r.id,
  parentId: r.parent_id,
  conversationId: r.conversation_id,
  title: r.title,
  pinned: r.pinned,
  position: r.position,
  updatedAt: new Date(r.updated_at).toISOString()
})
const mapNote = (r: any): AiNote => ({ ...mapSummary(r), content: r.content })

// Ghi chú Markdown riêng của từng người dùng N7AI (cây trang, ghim, xóa trang cha ⇒ xóa cả trang con)
@Injectable()
export class AiNotesService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string): Promise<AiNoteSummary[]> {
    const res = await this.db.query(`SELECT ${SUMMARY_COLS} FROM ai_notes WHERE user_id = $1 ORDER BY pinned DESC, position, updated_at DESC`, [userId])
    return res.rows.map(mapSummary)
  }

  async get(userId: string, id: string): Promise<AiNote> {
    const res = await this.db.query(`SELECT ${SUMMARY_COLS}, content FROM ai_notes WHERE id = $1 AND user_id = $2`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy ghi chú')
    return mapNote(res.rows[0])
  }

  async create(userId: string, input: AiNoteCreateInput): Promise<AiNote> {
    if (input.parentId) await this.assertOwned(userId, input.parentId)
    const res = await this.db.query(
      `INSERT INTO ai_notes (user_id, parent_id, conversation_id, title, content, position)
       SELECT $1, $2, $3, $4, $5, COALESCE((SELECT MAX(position) + 1 FROM ai_notes WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2::uuid), 0)
       WHERE (SELECT COUNT(*) FROM ai_notes WHERE user_id = $1) < $6
       RETURNING ${SUMMARY_COLS}, content`,
      [userId, input.parentId ?? null, input.conversationId ?? null, input.title ?? '', input.content ?? '', AI_NOTE_LIMIT]
    )
    if (!res.rows[0]) throw new BadRequestException(`Tối đa ${AI_NOTE_LIMIT} ghi chú`)
    return mapNote(res.rows[0])
  }

  async update(userId: string, id: string, input: AiNoteUpdateInput): Promise<AiNote> {
    if (input.parentId !== undefined && input.parentId !== null) await this.assertMovable(userId, id, input.parentId)
    const sets: string[] = []
    const values: unknown[] = [id, userId]
    const set = (col: string, value: unknown) => {
      values.push(value)
      sets.push(`${col} = $${values.length}`)
    }
    if (input.title !== undefined) set('title', input.title)
    if (input.content !== undefined) set('content', input.content)
    if (input.pinned !== undefined) set('pinned', input.pinned)
    if (input.parentId !== undefined) set('parent_id', input.parentId)
    if (!sets.length) return this.get(userId, id)
    const res = await this.db.query(`UPDATE ai_notes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING ${SUMMARY_COLS}, content`, values)
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy ghi chú')
    return mapNote(res.rows[0])
  }

  // Thêm đoạn Markdown vào cuối ghi chú (nút "Thêm vào ghi chú" ở tin nhắn N7AI)
  async append(userId: string, id: string, markdown: string): Promise<AiNote> {
    const res = await this.db.query(
      `UPDATE ai_notes
       SET content = CASE WHEN content = '' THEN $3 ELSE content || E'\n\n' || $3 END, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND length(content) + length($3) + 2 <= $4
       RETURNING ${SUMMARY_COLS}, content`,
      [id, userId, markdown, AI_NOTE_CONTENT_MAX]
    )
    if (!res.rows[0]) {
      await this.assertOwned(userId, id)
      throw new BadRequestException('Ghi chú đã đầy, hãy tạo trang mới')
    }
    return mapNote(res.rows[0])
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(`DELETE FROM ai_notes WHERE id = $1 AND user_id = $2`, [id, userId])
    if (!res.rowCount) throw new NotFoundException('Không tìm thấy ghi chú')
    return { deleted: true }
  }

  private async assertOwned(userId: string, id: string) {
    const res = await this.db.query(`SELECT 1 FROM ai_notes WHERE id = $1 AND user_id = $2`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy ghi chú')
  }

  // Không chuyển trang vào chính nó hay trang con của nó (tránh vòng lặp cây)
  private async assertMovable(userId: string, id: string, parentId: string) {
    await this.assertOwned(userId, parentId)
    const res = await this.db.query(
      `WITH RECURSIVE sub AS (
         SELECT id FROM ai_notes WHERE id = $1 AND user_id = $2
         UNION ALL
         SELECT n.id FROM ai_notes n JOIN sub s ON n.parent_id = s.id
       )
       SELECT 1 FROM sub WHERE id = $3`,
      [id, userId, parentId]
    )
    if (res.rows[0]) throw new BadRequestException('Không thể chuyển trang vào chính nó hoặc trang con')
  }
}
