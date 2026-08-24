import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { Course, CreateCourseInput } from '@pu/schemas'

@Injectable()
export class CoursesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(departmentId?: string): Promise<Course[]> {
    let sql = `
      SELECT c.*, f.name as department_name
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
      `SELECT c.*, f.name as department_name
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
      documentCount: row.document_count || 0,
      postCount: row.post_count || 0,
      rating: parseFloat(row.rating_avg) || 5.0
    }
  }
}

