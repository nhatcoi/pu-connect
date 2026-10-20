import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { Course, CourseOverview, CreateCourseInput } from '@pu/schemas'

// Đếm trực tiếp (cột document_count / post_count không được cập nhật)
const LIVE_COUNTS = `
  (SELECT COUNT(*) FROM documents d WHERE d.course_id = c.id AND d.visibility = 'public')::int AS live_document_count,
  (SELECT COUNT(*) FROM posts p WHERE p.course_id = c.id AND p.hidden_at IS NULL)::int AS live_post_count`

@Injectable()
export class CoursesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(departmentId?: string): Promise<Course[]> {
    let sql = `
      SELECT c.*, f.name as department_name, ${LIVE_COUNTS}
      FROM courses c
      LEFT JOIN faculties f ON c.faculty_id = f.id
      WHERE 1=1
    `
    const params: any[] = []
    if (departmentId) {
      params.push(departmentId)
      sql += ` AND (c.faculty_code = $1 OR c.faculty_id::text = $1)`
    }
    sql += ` ORDER BY c.rating_avg DESC, c.code ASC`

    const res = await this.db.query(sql, params)
    return res.rows.map((row) => this.mapRowToCourse(row))
  }

  async findOne(id: string): Promise<Course> {
    const res = await this.db.query(
      `SELECT c.*, f.name as department_name, ${LIVE_COUNTS}
       FROM courses c
       LEFT JOIN faculties f ON c.faculty_id = f.id
       WHERE c.id::text = $1 OR c.code ILIKE $1 LIMIT 1`,
      [id]
    )
    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy môn học (Mã: ${id})`)
    }
    return this.mapRowToCourse(res.rows[0])
  }

  // Trang học phần: số liệu Hỏi đáp / tài liệu / nhóm học + người đóng góp nhiều nhất
  async getOverview(idOrCode: string): Promise<CourseOverview> {
    const course = await this.findOne(idOrCode)
    const [stats, contributors] = await Promise.all([
      this.db.query(
        `SELECT
           (SELECT COUNT(*) FROM posts WHERE course_id = $1 AND post_type = 'question' AND hidden_at IS NULL)::int AS questions,
           (SELECT COUNT(*) FROM posts WHERE course_id = $1 AND post_type = 'question' AND is_resolved AND hidden_at IS NULL)::int AS solved,
           (SELECT COUNT(*) FROM study_groups WHERE course_id = $1 AND status <> 'disbanded')::int AS groups,
           (SELECT COUNT(*) FROM study_groups WHERE course_id = $1 AND status = 'recruiting')::int AS recruiting`,
        [course.id]
      ),
      this.db.query(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.role, SUM(x.n)::int AS contributions
         FROM (
           SELECT author_id AS uid, COUNT(*) AS n FROM posts WHERE course_id = $1 AND hidden_at IS NULL AND NOT is_anonymous GROUP BY author_id
           UNION ALL
           SELECT owner_id, COUNT(*) FROM documents WHERE course_id = $1 AND visibility = 'public' GROUP BY owner_id
           UNION ALL
           SELECT c.author_id, COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id
           WHERE p.course_id = $1 AND c.is_solution AND NOT c.is_anonymous GROUP BY c.author_id
         ) x JOIN users u ON u.id = x.uid
         WHERE u.status = 'active'
         GROUP BY u.id ORDER BY contributions DESC LIMIT 5`,
        [course.id]
      )
    ])
    const s = stats.rows[0]
    return {
      course,
      stats: {
        questionCount: s.questions,
        solvedCount: s.solved,
        documentCount: course.documentCount,
        groupCount: s.groups,
        recruitingGroupCount: s.recruiting
      },
      topContributors: contributors.rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        role: r.role,
        contributions: r.contributions
      }))
    }
  }

  async create(data: CreateCourseInput): Promise<Course> {
    const res = await this.db.query(
      `INSERT INTO courses (code, name, credits, faculty_code, description, rating_avg)
       VALUES ($1, $2, $3, $4, $5, 5.0)
       RETURNING *`,
      [data.code.toUpperCase().trim(), data.name.trim(), data.credits, data.departmentId || null, data.description || '']
    )
    return this.mapRowToCourse(res.rows[0])
  }

  private mapRowToCourse(row: any): Course {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      credits: row.credits,
      departmentId: row.faculty_code || 'FIT',
      departmentName: row.department_name || row.faculty_code || 'Khoa CNTT',
      semester: 'Học kỳ hiện tại',
      description: row.description || '',
      documentCount: row.live_document_count ?? row.document_count ?? 0,
      postCount: row.live_post_count ?? row.post_count ?? 0,
      rating: parseFloat(row.rating_avg) || 5.0
    }
  }
}
