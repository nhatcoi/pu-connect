import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  ChatStudySetRef,
  ReviewGrade,
  StudyAttemptInput,
  StudyItem,
  StudyItemContent,
  StudySetDetail,
  StudySetOptions,
  StudySetSummary,
  StudyToolKind,
  StudyToolsOverview
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { STUDY_SET_LIMIT, STUDY_TOOL_KINDS, type StudySetBody } from './dto/study-tools.dto'
import { nextReview } from './srs'
import { parseStudyBlocks } from './study-blocks'

// Cột tóm tắt bộ + số thẻ đến hạn (thẻ mới = đến hạn)
const SUMMARY_COLUMNS = `s.id, s.kind, s.title, s.description, s.source, s.options, s.source_message_id, s.item_count, s.attempts, s.best_score,
  s.last_studied_at, s.created_at, s.updated_at,
  CASE WHEN s.kind = 'flashcards'
       THEN (SELECT COUNT(*) FROM study_items i WHERE i.set_id = s.id AND (i.due_at IS NULL OR i.due_at <= NOW()))
       ELSE 0 END::int AS due_count`

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null)

const toSummary = (r: any): StudySetSummary => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  description: r.description,
  source: r.source,
  options: r.options ?? {},
  itemCount: r.item_count,
  dueCount: r.due_count ?? 0,
  bestScore: r.best_score,
  attempts: r.attempts,
  lastStudiedAt: iso(r.last_studied_at),
  sourceMessageId: r.source_message_id ? String(r.source_message_id) : null,
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!
})

const toItem = (r: any): StudyItem => ({
  id: r.id,
  position: r.position,
  content: r.content,
  dueAt: iso(r.due_at),
  intervalDays: Number(r.interval_days),
  reps: r.reps
})

// Công cụ học tập: bộ Flashcard / Quiz của người dùng (chỉ chủ bộ đọc / sửa)
@Injectable()
export class StudyToolsService {
  private readonly logger = new Logger(StudyToolsService.name)

  constructor(private readonly db: DatabaseService) {}

  // Trang tổng quan: số bộ / mục / thẻ đến hạn theo loại + 6 bộ gần đây
  async overview(userId: string): Promise<StudyToolsOverview> {
    const [counts, recent] = await Promise.all([
      this.db.query(
        `SELECT s.kind, COUNT(*)::int AS sets, COALESCE(SUM(s.item_count), 0)::int AS items,
                COALESCE(SUM(CASE WHEN s.kind = 'flashcards'
                  THEN (SELECT COUNT(*) FROM study_items i WHERE i.set_id = s.id AND (i.due_at IS NULL OR i.due_at <= NOW())) ELSE 0 END), 0)::int AS due
         FROM study_sets s WHERE s.owner_id = $1 GROUP BY s.kind`,
        [userId]
      ),
      this.db.query(`SELECT ${SUMMARY_COLUMNS} FROM study_sets s WHERE s.owner_id = $1 ORDER BY COALESCE(s.last_studied_at, s.updated_at) DESC LIMIT 6`, [
        userId
      ])
    ])
    const byKind = new Map(counts.rows.map((r) => [r.kind, r]))
    return {
      kinds: STUDY_TOOL_KINDS.map((kind) => ({ kind, sets: byKind.get(kind)?.sets ?? 0, items: byKind.get(kind)?.items ?? 0, due: byKind.get(kind)?.due ?? 0 })),
      recent: recent.rows.map(toSummary)
    }
  }

  async list(userId: string, kind: StudyToolKind | undefined, q: string): Promise<StudySetSummary[]> {
    const res = await this.db.query(
      `SELECT ${SUMMARY_COLUMNS} FROM study_sets s
       WHERE s.owner_id = $1 AND ($2::text IS NULL OR s.kind = $2) AND ($3 = '' OR s.title ILIKE '%' || $3 || '%')
       ORDER BY s.updated_at DESC LIMIT 200`,
      [userId, kind ?? null, q]
    )
    return res.rows.map(toSummary)
  }

  async get(userId: string, id: string): Promise<StudySetDetail> {
    const set = await this.db.query(`SELECT ${SUMMARY_COLUMNS}, s.owner_id FROM study_sets s WHERE s.id = $1`, [id])
    const row = set.rows[0]
    if (!row) throw new NotFoundException('Không tìm thấy bộ học tập')
    if (row.owner_id !== userId) throw new ForbiddenException('Bạn không có quyền xem bộ này')
    const items = await this.db.query(`SELECT * FROM study_items WHERE set_id = $1 ORDER BY position`, [id])
    return { ...toSummary(row), items: items.rows.map(toItem) }
  }

  async create(userId: string, body: StudySetBody, origin?: { source: 'n7ai'; messageId?: string }): Promise<StudySetDetail> {
    const id = await this.db.transaction(async (client) => {
      const count = await client.query(`SELECT COUNT(*)::int AS n FROM study_sets WHERE owner_id = $1`, [userId])
      if (count.rows[0].n >= STUDY_SET_LIMIT) throw new BadRequestException(`Tối đa ${STUDY_SET_LIMIT} bộ — xóa bớt bộ cũ nhé`)
      const ins = await client.query(
        `INSERT INTO study_sets (owner_id, kind, title, description, options, source, source_message_id, item_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          userId,
          body.kind,
          body.title,
          body.description || null,
          JSON.stringify(body.options ?? {}),
          origin?.source ?? 'manual',
          origin?.messageId ?? null,
          body.items.length
        ]
      )
      await this.insertItems(client, ins.rows[0].id, body.items.map((it) => it.content))
      return ins.rows[0].id as string
    })
    return this.get(userId, id)
  }

  // Sửa: thay danh sách mục theo thứ tự mới; mục giữ id ⇒ giữ lịch ôn, mục mất ⇒ xóa
  async update(userId: string, id: string, body: StudySetBody): Promise<StudySetDetail> {
    await this.db.transaction(async (client) => {
      const cur = await client.query(`SELECT owner_id, kind FROM study_sets WHERE id = $1 FOR UPDATE`, [id])
      const row = cur.rows[0]
      if (!row) throw new NotFoundException('Không tìm thấy bộ học tập')
      if (row.owner_id !== userId) throw new ForbiddenException('Bạn không có quyền sửa bộ này')
      if (row.kind !== body.kind) throw new BadRequestException('Không đổi được loại bộ')

      const keep = body.items.map((it) => it.id).filter((v): v is string => !!v)
      await client.query(`DELETE FROM study_items WHERE set_id = $1 AND NOT (id = ANY($2::uuid[]))`, [id, keep])
      const existing = new Set((await client.query(`SELECT id FROM study_items WHERE set_id = $1`, [id])).rows.map((r) => r.id as string))
      const fresh: { position: number; content: StudyItemContent }[] = []
      for (const [position, it] of body.items.entries()) {
        if (it.id && existing.has(it.id)) {
          await client.query(`UPDATE study_items SET position = $3, content = $4 WHERE id = $1 AND set_id = $2`, [it.id, id, position, JSON.stringify(it.content)])
        } else fresh.push({ position, content: it.content })
      }
      await this.insertItems(
        client,
        id,
        fresh.map((f) => f.content),
        fresh.map((f) => f.position)
      )
      await client.query(`UPDATE study_sets SET title = $2, description = $3, options = $4, item_count = $5, updated_at = NOW() WHERE id = $1`, [
        id,
        body.title,
        body.description || null,
        JSON.stringify(body.options ?? {}),
        body.items.length
      ])
    })
    return this.get(userId, id)
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.db.query(`DELETE FROM study_sets WHERE id = $1 AND owner_id = $2`, [id, userId])
    if (!res.rowCount) throw new NotFoundException('Không tìm thấy bộ học tập')
  }

  // Ôn 1 thẻ: tính lịch ôn kế tiếp (SM-2 rút gọn)
  async review(userId: string, setId: string, itemId: string, grade: ReviewGrade): Promise<{ item: StudyItem; dueCount: number }> {
    return this.db.transaction(async (client) => {
      const res = await client.query(
        `SELECT i.* FROM study_items i JOIN study_sets s ON s.id = i.set_id
         WHERE i.id = $1 AND i.set_id = $2 AND s.owner_id = $3 AND s.kind = 'flashcards' FOR UPDATE OF i`,
        [itemId, setId, userId]
      )
      const cur = res.rows[0]
      if (!cur) throw new NotFoundException('Không tìm thấy thẻ')
      const next = nextReview({ intervalDays: Number(cur.interval_days), ease: Number(cur.ease), reps: cur.reps, lapses: cur.lapses }, grade)
      const upd = await client.query(
        `UPDATE study_items SET due_at = $2, interval_days = $3, ease = $4, reps = $5, lapses = $6 WHERE id = $1 RETURNING *`,
        [itemId, next.dueAt, next.intervalDays, next.ease, next.reps, next.lapses]
      )
      const due = await client.query(
        `UPDATE study_sets SET attempts = attempts + 1, last_studied_at = NOW() WHERE id = $1
         RETURNING (SELECT COUNT(*) FROM study_items i WHERE i.set_id = $1 AND (i.due_at IS NULL OR i.due_at <= NOW()))::int AS due_count`,
        [setId]
      )
      return { item: toItem(upd.rows[0]), dueCount: due.rows[0].due_count }
    })
  }

  // Kết quả 1 lần làm quiz ⇒ cập nhật điểm cao nhất
  async attempt(userId: string, setId: string, input: StudyAttemptInput): Promise<StudySetSummary> {
    const score = Math.round((input.correct / input.total) * 100)
    const res = await this.db.query(
      `UPDATE study_sets s SET attempts = attempts + 1, best_score = GREATEST(COALESCE(best_score, 0), $3), last_studied_at = NOW()
       WHERE s.id = $1 AND s.owner_id = $2 AND s.kind = 'quiz' RETURNING ${SUMMARY_COLUMNS}`,
      [setId, userId, score]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy quiz')
    return toSummary(res.rows[0])
  }

  // Dự phòng: model tự viết khối ```flashcards / ```quiz thay vì gọi tool ⇒ lưu khối đầu tiên (lỗi không chặn câu trả lời)
  // Legacy fallback for inline study fences in an N7AI reply
  async saveFromReply(userId: string, messageId: string, text: string): Promise<ChatStudySetRef | null> {
    const block = parseStudyBlocks(text)[0]
    if (!block) return null
    try {
      return await this.saveForMessage(userId, messageId, block)
    } catch (err: any) {
      this.logger.warn(`Không tự lưu được bộ học tập (msg ${messageId}): ${err?.message}`)
      return null
    }
  }

  // Lưu bộ N7AI tạo cho 1 tin (tool create_* hoặc khối dự phòng); 1 tin ⇒ tối đa 1 bộ; null = đã có bộ cho tin này
  // Throws BadRequest when the user hit the set limit (tool call reports it to the model)
  async saveForMessage(
    userId: string,
    messageId: string,
    set: { kind: StudyToolKind; title: string; description?: string | null; options: StudySetOptions; items: StudyItemContent[] }
  ): Promise<ChatStudySetRef | null> {
    return this.db.transaction(async (client) => {
      const count = await client.query(`SELECT COUNT(*)::int AS n FROM study_sets WHERE owner_id = $1`, [userId])
      if (count.rows[0].n >= STUDY_SET_LIMIT) throw new BadRequestException(`Tối đa ${STUDY_SET_LIMIT} bộ — xóa bớt bộ cũ nhé`)
      const ins = await client.query(
        `INSERT INTO study_sets (owner_id, kind, title, description, options, source, source_message_id, item_count)
         VALUES ($1, $2, $3, $4, $5, 'n7ai', $6, $7)
         ON CONFLICT (source_message_id) WHERE source_message_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [userId, set.kind, set.title, set.description || null, JSON.stringify(set.options), messageId, set.items.length]
      )
      if (!ins.rows[0]) return null
      await this.insertItems(client, ins.rows[0].id, set.items)
      return { id: ins.rows[0].id as string, kind: set.kind, title: set.title }
    })
  }

  // Chèn nhiều mục 1 câu lệnh (unnest) / Bulk insert items
  private async insertItems(client: PoolClient, setId: string, contents: StudyItemContent[], positions?: number[]) {
    if (!contents.length) return
    await client.query(
      `INSERT INTO study_items (set_id, position, content)
       SELECT $1, p, c::jsonb FROM unnest($2::int[], $3::text[]) AS t(p, c)`,
      [setId, positions ?? contents.map((_, i) => i), contents.map((c) => JSON.stringify(c))]
    )
  }
}
