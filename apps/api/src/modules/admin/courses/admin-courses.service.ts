import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdminCourseImportResult, AdminCourseLecturer, AdminCourseSuggestion } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { writeAudit } from '../admin-audit'
import { toSuggestion } from '../../courses/course-suggestions.service'
import { CourseRowSchema, type CourseImport, type SuggestionApprove } from './admin-courses.dto'

type FkRef = { tbl: string; col: string }

// Học phần: giảng viên phụ trách, gộp môn trùng, xóa môn trống, nhập hàng loạt
@Injectable()
export class AdminCoursesService {
  constructor(private readonly db: DatabaseService) {}

  // Mọi cột khóa ngoại trỏ vào courses (trừ bảng giảng viên) lấy từ catalog, nên bảng mới thêm sau vẫn được gộp/chặn xóa đúng
  private async references(client: { query: DatabaseService['query'] }): Promise<FkRef[]> {
    const res = await client.query(
      `SELECT c.conrelid::regclass::text AS tbl, quote_ident(a.attname) AS col
       FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.contype = 'f' AND c.confrelid = 'courses'::regclass AND array_length(c.conkey, 1) = 1
         AND c.conrelid <> 'course_lecturers'::regclass`
    )
    return res.rows
  }

  // Đề xuất môn học theo trạng thái (mới nhất trước)
  async suggestions(status: string): Promise<AdminCourseSuggestion[]> {
    const res = await this.db.query(
      `SELECT s.*, u.username, u.display_name FROM course_suggestions s JOIN users u ON u.id = s.requester_id
       WHERE s.status = $1 ORDER BY s.created_at DESC LIMIT 200`,
      [status]
    )
    return res.rows.map((r) => ({ ...toSuggestion(r), requester: { id: r.requester_id, username: r.username, displayName: r.display_name } }))
  }

  // Duyệt ⇒ tạo môn thật theo thông tin admin chốt
  async approveSuggestion(adminId: string, id: string, input: SuggestionApprove): Promise<{ courseId: string }> {
    return this.db.transaction(async (client) => {
      const sug = (await client.query(`SELECT status FROM course_suggestions WHERE id = $1 FOR UPDATE`, [id])).rows[0]
      if (!sug) throw new NotFoundException('Đề xuất không tồn tại')
      if (sug.status !== 'pending') throw new ConflictException('Đề xuất này đã được xử lý')
      if ((await client.query(`SELECT 1 FROM courses WHERE upper(code) = $1`, [input.code])).rows.length) throw new ConflictException(`Mã môn ${input.code} đã tồn tại`)
      const fac = await client.query(`SELECT id FROM faculties WHERE upper(code) = $1 LIMIT 1`, [input.facultyCode.toUpperCase()])
      const course = await client.query(
        `INSERT INTO courses (code, name, credits, faculty_id, faculty_code) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [input.code, input.name, input.credits, fac.rows[0]?.id ?? null, input.facultyCode.toUpperCase()]
      )
      const courseId = course.rows[0].id as string
      await client.query(`UPDATE course_suggestions SET status = 'approved', reviewer_id = $2, course_id = $3, reviewed_at = NOW() WHERE id = $1`, [id, adminId, courseId])
      await writeAudit(client, adminId, { action: 'course.suggestion.approve', targetType: 'course', targetId: courseId, details: { suggestionId: id, code: input.code } })
      return { courseId }
    })
  }

  async rejectSuggestion(adminId: string, id: string, note: string): Promise<{ ok: true }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE course_suggestions SET status = 'rejected', review_note = $2, reviewer_id = $3, reviewed_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id`,
        [id, note, adminId]
      )
      if (!res.rows.length) throw new ConflictException('Đề xuất không còn chờ duyệt')
      await writeAudit(client, adminId, { action: 'course.suggestion.reject', targetType: 'course', targetId: id, details: { note } })
    })
    return { ok: true }
  }

  async lecturers(courseId: string): Promise<AdminCourseLecturer[]> {
    const res = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.role FROM course_lecturers cl
       JOIN users u ON u.id = cl.user_id WHERE cl.course_id = $1 ORDER BY u.display_name`,
      [courseId]
    )
    return res.rows.map(toLecturer)
  }

  // Ứng viên: giảng viên và trợ giảng, tìm theo tên hoặc @username
  async candidates(q?: string): Promise<AdminCourseLecturer[]> {
    const term = q?.trim()
    const res = await this.db.query(
      `SELECT id, username, display_name, avatar_url, role FROM users
       WHERE role IN ('lecturer', 'ta') AND account_type = 'human' AND status = 'active'
         AND ($1::text IS NULL OR username ILIKE $1 || '%' OR display_name ILIKE '%' || $1 || '%')
       ORDER BY display_name LIMIT 20`,
      [term || null]
    )
    return res.rows.map(toLecturer)
  }

  async setLecturers(adminId: string, courseId: string, userIds: string[]): Promise<AdminCourseLecturer[]> {
    const ids = [...new Set(userIds)]
    await this.db.transaction(async (client) => {
      if (!(await client.query(`SELECT 1 FROM courses WHERE id = $1 FOR UPDATE`, [courseId])).rows[0]) throw new NotFoundException('Môn học không tồn tại')
      const valid = await client.query(`SELECT id FROM users WHERE id = ANY($1::uuid[]) AND role IN ('lecturer', 'ta')`, [ids])
      if (valid.rows.length !== ids.length) throw new BadRequestException('Chỉ gán được giảng viên hoặc trợ giảng')
      await client.query(`DELETE FROM course_lecturers WHERE course_id = $1 AND NOT (user_id = ANY($2::uuid[]))`, [courseId, ids])
      await client.query(
        `INSERT INTO course_lecturers (course_id, user_id, assigned_by) SELECT $1, x, $3 FROM unnest($2::uuid[]) x ON CONFLICT DO NOTHING`,
        [courseId, ids, adminId]
      )
      await writeAudit(client, adminId, { action: 'course.lecturers', targetType: 'course', targetId: courseId, details: { userIds: ids } })
    })
    return this.lecturers(courseId)
  }

  // Gộp `fromId` vào `intoId`: chuyển mọi dữ liệu tham chiếu, cộng bộ đếm, rồi xóa môn nguồn
  async merge(adminId: string, fromId: string, intoId: string): Promise<{ moved: number }> {
    if (fromId === intoId) throw new BadRequestException('Không thể gộp môn vào chính nó')
    return this.db.transaction(async (client) => {
      const rows = await client.query(`SELECT id, code, document_count, post_count FROM courses WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [[fromId, intoId]])
      const from = rows.rows.find((r) => r.id === fromId)
      const into = rows.rows.find((r) => r.id === intoId)
      if (!from || !into) throw new NotFoundException('Môn học không tồn tại')

      let moved = 0
      for (const { tbl, col } of await this.references(client)) {
        moved += (await client.query(`UPDATE ${tbl} SET ${col} = $1 WHERE ${col} = $2`, [intoId, fromId])).rowCount ?? 0
        // Bảng lưu thêm mã/tên môn (study_groups) phải khớp môn đích
        const extra = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ('course_code', 'course_name')`, [tbl.replace(/^public\./, '').replace(/"/g, '')])
        const names = extra.rows.map((r) => r.column_name)
        if (names.includes('course_code')) await client.query(`UPDATE ${tbl} SET course_code = $1 WHERE ${col} = $2`, [into.code, intoId])
        if (names.includes('course_name')) await client.query(`UPDATE ${tbl} SET course_name = (SELECT name FROM courses WHERE id = $1) WHERE ${col} = $1`, [intoId])
      }
      await client.query(`INSERT INTO course_lecturers (course_id, user_id, assigned_by) SELECT $1, user_id, $3 FROM course_lecturers WHERE course_id = $2 ON CONFLICT DO NOTHING`, [intoId, fromId, adminId])
      await client.query(`UPDATE courses SET document_count = document_count + $2, post_count = post_count + $3, updated_at = NOW() WHERE id = $1`, [intoId, from.document_count ?? 0, from.post_count ?? 0])
      await client.query(`DELETE FROM courses WHERE id = $1`, [fromId])
      await writeAudit(client, adminId, { action: 'course.merge', targetType: 'course', targetId: intoId, details: { from: from.code, into: into.code, moved } })
      return { moved }
    })
  }

  // Chỉ xóa môn không còn dữ liệu; còn dữ liệu thì gộp sang môn khác
  async remove(adminId: string, id: string): Promise<{ deleted: true }> {
    return this.db.transaction(async (client) => {
      const cur = await client.query(`SELECT code, name FROM courses WHERE id = $1 FOR UPDATE`, [id])
      if (!cur.rows[0]) throw new NotFoundException('Môn học không tồn tại')
      for (const { tbl, col } of await this.references(client)) {
        const n = (await client.query(`SELECT COUNT(*)::int AS n FROM ${tbl} WHERE ${col} = $1`, [id])).rows[0].n
        if (n > 0) throw new ConflictException('Môn còn bài viết, tài liệu hoặc nhóm gắn vào. Hãy gộp sang môn khác thay vì xóa.')
      }
      await client.query(`DELETE FROM courses WHERE id = $1`, [id])
      await writeAudit(client, adminId, { action: 'course.delete', targetType: 'course', targetId: id, details: cur.rows[0] })
      return { deleted: true as const }
    })
  }

  // Nhập hàng loạt theo mã môn: chưa có thì tạo, có rồi thì cập nhật. dryRun chỉ kiểm tra
  async importRows(adminId: string, input: CourseImport): Promise<AdminCourseImportResult> {
    const errors: { row: number; message: string }[] = []
    const valid: ReturnType<typeof CourseRowSchema.parse>[] = []
    const seen = new Set<string>()
    input.rows.forEach((raw, i) => {
      const parsed = CourseRowSchema.safeParse(raw)
      if (!parsed.success) return void errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? 'Dòng không hợp lệ' })
      if (seen.has(parsed.data.code)) return void errors.push({ row: i + 1, message: `Mã ${parsed.data.code} bị lặp trong file` })
      seen.add(parsed.data.code)
      valid.push(parsed.data)
    })
    const existing = new Set(
      (await this.db.query(`SELECT code FROM courses WHERE code = ANY($1::text[])`, [valid.map((v) => v.code)])).rows.map((r) => r.code as string)
    )
    const created = valid.filter((v) => !existing.has(v.code)).length
    const result: AdminCourseImportResult = { created, updated: valid.length - created, errors, applied: false }
    if (input.dryRun || errors.length || valid.length === 0) return result

    await this.db.transaction(async (client) => {
      for (const v of valid) {
        await client.query(
          `INSERT INTO courses (code, name, credits, faculty_id, faculty_code, description, syllabus_url)
           VALUES ($1, $2, $3, (SELECT id FROM faculties WHERE UPPER(code) = $4 LIMIT 1), $4, $5, $6)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, credits = EXCLUDED.credits, faculty_id = EXCLUDED.faculty_id,
             faculty_code = EXCLUDED.faculty_code, description = EXCLUDED.description, syllabus_url = EXCLUDED.syllabus_url, updated_at = NOW()`,
          [v.code, v.name, v.credits, v.facultyCode.toUpperCase(), v.description || null, v.syllabusUrl || null]
        )
      }
      await writeAudit(client, adminId, { action: 'course.import', targetType: 'course', targetId: 'bulk', details: { created, updated: result.updated } })
    })
    return { ...result, applied: true }
  }
}

const toLecturer = (r: { id: string; username: string; display_name: string; avatar_url: string | null; role: string }): AdminCourseLecturer => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  role: r.role as AdminCourseLecturer['role']
})
