import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiMemory } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { AI_MEMORY_LIMIT } from '../dto/n7ai.dto'

const RECALL_LIMIT = 8
const RECALL_CHARS = 2000
const DUPLICATE_SIMILARITY = 0.6 // trigram ⇒ coi như đã nhớ

const mapMemory = (r: any): AiMemory => ({ id: r.id, content: r.content, source: r.source, pinned: r.pinned, createdAt: new Date(r.created_at).toISOString() })

// Bộ nhớ dài hạn của người học (khác tóm tắt từng thread): dữ kiện bền như ngành, môn, lịch thi, cách học ưa thích
// Ghi: N7AI trả kèm dòng "[nhớ] …" trong cùng lượt trả lời (không tốn thêm lượt LLM) hoặc người dùng tự thêm
// Đọc: mục ghim luôn có, rồi ≤ 8 mục liên quan câu hỏi (trigram) + mới nhất
@Injectable()
export class AiMemoriesService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string): Promise<AiMemory[]> {
    const res = await this.db.query(`SELECT id, content, source, pinned, created_at FROM ai_memories WHERE user_id = $1 ORDER BY pinned DESC, created_at DESC`, [
      userId
    ])
    return res.rows.map(mapMemory)
  }

  async create(userId: string, content: string): Promise<AiMemory> {
    const res = await this.db.query(
      `INSERT INTO ai_memories (user_id, content, source)
       SELECT $1, $2, 'manual' WHERE (SELECT COUNT(*) FROM ai_memories WHERE user_id = $1) < $3
       RETURNING id, content, source, pinned, created_at`,
      [userId, content, AI_MEMORY_LIMIT]
    )
    if (!res.rows[0]) throw new BadRequestException(`Tối đa ${AI_MEMORY_LIMIT} mục nhớ — xóa bớt mục cũ`)
    return mapMemory(res.rows[0])
  }

  async update(userId: string, id: string, content: string): Promise<AiMemory> {
    const res = await this.db.query(
      `UPDATE ai_memories SET content = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, content, source, pinned, created_at`,
      [id, userId, content]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy mục nhớ')
    return mapMemory(res.rows[0])
  }

  // Ghim / bỏ ghim (chỉ chủ mục)
  async setPinned(userId: string, id: string, pinned: boolean): Promise<AiMemory> {
    const res = await this.db.query(
      `UPDATE ai_memories SET pinned = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, content, source, pinned, created_at`,
      [id, userId, pinned]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy mục nhớ')
    return mapMemory(res.rows[0])
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(`DELETE FROM ai_memories WHERE id = $1 AND user_id = $2 RETURNING 1`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy mục nhớ')
    return { deleted: true }
  }

  async clear(userId: string): Promise<{ deleted: number }> {
    const res = await this.db.query(`DELETE FROM ai_memories WHERE user_id = $1`, [userId])
    return { deleted: res.rowCount ?? 0 }
  }

  // Mục ghim trước (luôn có), rồi liên quan câu hỏi, rồi mới nhất; cắt theo ngân sách ký tự
  async recall(userId: string, question: string): Promise<string[]> {
    const res = await this.db.query(
      `SELECT content FROM ai_memories WHERE user_id = $1
       ORDER BY pinned DESC, similarity(immutable_unaccent(lower(content)), immutable_unaccent(lower($2))) DESC, created_at DESC
       LIMIT $3::int + (SELECT COUNT(*) FROM ai_memories WHERE user_id = $1 AND pinned)::int`,
      [userId, question.slice(0, 500), RECALL_LIMIT]
    )
    const out: string[] = []
    let budget = RECALL_CHARS
    for (const r of res.rows) {
      if (r.content.length > budget) break
      budget -= r.content.length
      out.push(r.content)
    }
    return out
  }

  // Lưu dữ kiện N7AI vừa rút ra: bỏ mục trùng (trigram), vượt giới hạn ⇒ bỏ mục tự động cũ nhất; trả các mục đã lưu
  async saveFromReply(userId: string, messageId: string, facts: string[]): Promise<string[]> {
    const saved: string[] = []
    for (const fact of facts.slice(0, 2)) {
      const content = fact.trim().slice(0, 300)
      if (content.length < 3) continue
      const res = await this.db.query(
        `WITH dup AS (
           SELECT 1 FROM ai_memories WHERE user_id = $1
             AND similarity(immutable_unaccent(lower(content)), immutable_unaccent(lower($2))) >= $4 LIMIT 1
         ), ins AS (
           INSERT INTO ai_memories (user_id, content, source, source_message_id)
           SELECT $1, $2, 'auto', $3 WHERE NOT EXISTS (SELECT 1 FROM dup) RETURNING id
         )
         SELECT id FROM ins`,
        [userId, content, messageId, DUPLICATE_SIMILARITY]
      )
      if (res.rows[0]) saved.push(content)
    }
    if (saved.length) {
      await this.db.query(
        `DELETE FROM ai_memories WHERE id IN (
           SELECT id FROM ai_memories WHERE user_id = $1 AND source = 'auto' AND NOT pinned
           ORDER BY created_at DESC OFFSET GREATEST(0, $2 - (SELECT COUNT(*) FROM ai_memories WHERE user_id = $1 AND (source = 'manual' OR pinned))))`,
        [userId, AI_MEMORY_LIMIT]
      )
    }
    return saved
  }
}
