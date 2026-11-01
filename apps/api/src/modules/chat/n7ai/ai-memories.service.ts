import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiMemory } from '@pu/schemas'
import { Logger } from '@nestjs/common'
import { DatabaseService } from '../../../database/database.service'
import { LlmService } from '../../ai/llm.service'
import { AI_MEMORY_LIMIT } from '../dto/n7ai.dto'

const RECALL_LIMIT = 8
const RECALL_CHARS = 2000
const DUPLICATE_SIMILARITY = 0.6 // trigram ⇒ coi như đã nhớ
const CONSOLIDATE_MIN = 30 // chỉ hợp nhất khi dữ kiện tự động chưa ghim vượt ngưỡng này
const CONSOLIDATE_BATCH = 80 // số dữ kiện cũ nhất đưa vào một lần hợp nhất
const CONSOLIDATE_KEEP = 25 // số dòng tối đa sau hợp nhất
const CONSOLIDATE_USERS = 20 // số người xử lý mỗi lần chạy

const CONSOLIDATE_PROMPT = `Bạn nhận danh sách dữ kiện ngắn đã ghi nhớ về một người học (dòng càng về cuối càng mới). Hãy hợp nhất:
- gộp dữ kiện trùng hoặc chồng nghĩa thành một dòng;
- bỏ dữ kiện lỗi thời hoặc bị dữ kiện mới hơn mâu thuẫn;
- giữ nguyên ý nghĩa, không bịa thêm, mỗi dòng một dữ kiện ngắn (≤ 200 ký tự), tối đa ${CONSOLIDATE_KEEP} dòng.
Chỉ trả về mảng JSON các chuỗi, không giải thích.`

const mapMemory = (r: any): AiMemory => ({ id: r.id, content: r.content, source: r.source, pinned: r.pinned, createdAt: new Date(r.created_at).toISOString() })

// Bộ nhớ dài hạn của người học (khác tóm tắt từng thread): dữ kiện bền như ngành, môn, lịch thi, cách học ưa thích
// Ghi: N7AI trả kèm dòng "[nhớ] …" trong cùng lượt trả lời (không tốn thêm lượt LLM) hoặc người dùng tự thêm
// Đọc: mục ghim luôn có, rồi ≤ 8 mục liên quan câu hỏi (trigram) + mới nhất
@Injectable()
export class AiMemoriesService {
  private readonly logger = new Logger(AiMemoriesService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService
  ) {}

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

  // Hợp nhất định kỳ (worker hằng ngày): người có quá nhiều dữ kiện tự động ⇒ gộp trùng, bỏ lỗi thời thành hồ sơ ngắn. Trả số người đã xử lý
  async consolidateDue(): Promise<number> {
    const due = await this.db.query(
      `SELECT user_id FROM ai_memories WHERE source = 'auto' AND NOT pinned AND study_set_id IS NULL
       GROUP BY user_id HAVING COUNT(*) > $1 ORDER BY MIN(created_at) LIMIT $2`,
      [CONSOLIDATE_MIN, CONSOLIDATE_USERS]
    )
    let done = 0
    for (const row of due.rows) {
      try {
        if (await this.consolidate(row.user_id)) done++
      } catch (err) {
        this.logger.warn(`Hợp nhất bộ nhớ lỗi (user ${row.user_id}): ${(err as Error).message?.slice(0, 120)}`)
      }
    }
    return done
  }

  async consolidate(userId: string): Promise<boolean> {
    if (!this.llm.client) return false
    const res = await this.db.query(
      `SELECT id, content FROM ai_memories WHERE user_id = $1 AND source = 'auto' AND NOT pinned AND study_set_id IS NULL ORDER BY created_at LIMIT $2`,
      [userId, CONSOLIDATE_BATCH]
    )
    if (res.rows.length <= CONSOLIDATE_MIN) return false
    const { text, finishReason } = await this.llm.complete(
      [
        { role: 'system', content: CONSOLIDATE_PROMPT },
        { role: 'user', content: res.rows.map((r, i) => `${i + 1}. ${r.content}`).join('\n') }
      ],
      2000
    )
    const merged = parseFacts(text)
    // Kết quả hỏng / cụt / không gọn hơn ⇒ giữ nguyên, không đụng dữ liệu
    if (finishReason === 'length' || !merged || merged.length === 0 || merged.length >= res.rows.length) return false
    const ids = res.rows.map((r) => r.id)
    await this.db.transaction(async (client) => {
      const removed = await client.query(`DELETE FROM ai_memories WHERE user_id = $1 AND id = ANY($2::uuid[]) AND source = 'auto' AND NOT pinned`, [userId, ids])
      if (removed.rowCount !== ids.length) throw new Error('Dữ kiện đã đổi trong lúc hợp nhất')
      for (const fact of merged) await client.query(`INSERT INTO ai_memories (user_id, content, source) VALUES ($1, $2, 'auto')`, [userId, fact])
    })
    return true
  }
}

// Mảng JSON các chuỗi (có thể bọc trong ```json); sai dạng ⇒ null
export function parseFacts(text: string): string[] | null {
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  try {
    const value: unknown = JSON.parse(body)
    if (!Array.isArray(value)) return null
    const facts = value.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 300)).filter((x) => x.length >= 3)
    return facts.length === value.length ? facts.slice(0, CONSOLIDATE_KEEP) : null
  } catch {
    return null
  }
}
