import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import type { CourseSuggestion } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { MAX_PENDING_SUGGESTIONS, type CourseSuggestionBody } from './course-suggestions.dto'

export const toSuggestion = (r: any): CourseSuggestion => ({
  id: r.id,
  name: r.name,
  code: r.code,
  fieldId: r.interest_field_id,
  fieldName: r.field_name ?? null,
  credits: r.credits,
  note: r.note,
  status: r.status,
  reviewNote: r.review_note,
  courseId: r.course_id,
  createdAt: r.created_at.toISOString(),
  reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null
})

// Đề xuất môn học của người dùng (admin duyệt ở AdminCoursesService)
@Injectable()
export class CourseSuggestionsService {
  constructor(private readonly db: DatabaseService) {}

  async mine(userId: string): Promise<CourseSuggestion[]> {
    const res = await this.db.query(`SELECT s.*, f.name AS field_name FROM course_suggestions s LEFT JOIN interest_fields f ON f.id = s.interest_field_id WHERE s.requester_id = $1 ORDER BY s.created_at DESC LIMIT 50`, [userId])
    return res.rows.map(toSuggestion)
  }

  async create(userId: string, body: CourseSuggestionBody): Promise<CourseSuggestion> {
    const code = body.code || null
    return this.db.transaction(async (client) => {
      // Khóa theo người dùng để 2 yêu cầu song song không vượt giới hạn chờ duyệt
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`course-suggest:${userId}`])
      const exists = await client.query(`SELECT 1 FROM courses WHERE lower(name) = lower($1) OR ($2::text IS NOT NULL AND upper(code) = $2) LIMIT 1`, [body.name, code])
      if (exists.rows.length) throw new ConflictException('Môn học này đã có trong danh mục')
      const pending = await client.query(`SELECT lower(name) = lower($2) AS same FROM course_suggestions WHERE requester_id = $1 AND status = 'pending'`, [userId, body.name])
      if (pending.rows.some((r) => r.same)) throw new ConflictException('Bạn đã đề xuất môn này, đang chờ duyệt')
      if (pending.rows.length >= MAX_PENDING_SUGGESTIONS) throw new BadRequestException(`Bạn đang có ${MAX_PENDING_SUGGESTIONS} đề xuất chờ duyệt, đợi admin xử lý trước nhé`)
      const res = await client.query(
        `INSERT INTO course_suggestions (requester_id, name, code, interest_field_id, credits, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, body.name, code, body.fieldId || null, body.credits ?? null, body.note || null]
      )
      return toSuggestion(res.rows[0])
    })
  }
}
