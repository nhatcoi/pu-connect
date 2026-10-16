import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { CreateDocumentInput, DocumentItem } from '@pu/schemas'

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(type?: string, search?: string, course?: string): Promise<DocumentItem[]> {
    let sql = `
      SELECT d.*,
             u.id as user_id, u.email as user_email, u.username as user_username,
             u.display_name as user_display_name, u.avatar_url as user_avatar_url,
             u.role as user_role, u.faculty as user_faculty, u.reputation_points as user_reputation_points,
             c.code as course_code
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN courses c ON d.course_id = c.id
      WHERE d.visibility = 'public'
    `
    const params: any[] = []

    if (course) {
      params.push(course)
      sql += ` AND (c.code ILIKE $${params.length} OR c.id::text = $${params.length})`
    }

    if (type && type !== 'all') {
      params.push(type)
      sql += ` AND d.type = $${params.length}`
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`)
      sql += ` AND (d.title ILIKE $${params.length} OR d.description ILIKE $${params.length} OR $${params.length} = ANY(d.tags))`
    }

    sql += ` ORDER BY d.download_count DESC, d.created_at DESC LIMIT 50`

    const res = await this.db.query(sql, params)
    return res.rows.map((row) => this.mapRowToDocument(row))
  }

  async findOne(id: string): Promise<DocumentItem> {
    const res = await this.db.query(
      `SELECT d.*,
              u.id as user_id, u.email as user_email, u.username as user_username,
              u.display_name as user_display_name, u.avatar_url as user_avatar_url,
              u.role as user_role, u.faculty as user_faculty, u.reputation_points as user_reputation_points,
              c.code as course_code
       FROM documents d
       JOIN users u ON d.owner_id = u.id
       LEFT JOIN courses c ON d.course_id = c.id
       WHERE d.id::text = $1 LIMIT 1`,
      [id]
    )
    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy tài liệu (ID: ${id})`)
    }
    await this.db.query(`UPDATE documents SET view_count = view_count + 1 WHERE id::text = $1`, [id])
    return this.mapRowToDocument(res.rows[0])
  }

  async create(ownerId: string, data: CreateDocumentInput): Promise<DocumentItem> {
    const resolvedOwnerId = ownerId

    const insertRes = await this.db.query(
      `INSERT INTO documents (
        owner_id, course_id, title, description, type, file_url, file_size, mime_type, tags, visibility
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        resolvedOwnerId,
        data.courseId || null,
        data.title,
        data.description || null,
        data.type || 'pdf',
        data.fileUrl,
        data.fileSize || 1048576,
        data.mimeType || 'application/pdf',
        data.tags || [],
        data.visibility || 'public'
      ]
    )
    return this.findOne(insertRes.rows[0].id)
  }

  async incrementDownload(id: string): Promise<{ downloadUrl: string }> {
    const res = await this.db.query(`UPDATE documents SET download_count = download_count + 1 WHERE id::text = $1 RETURNING file_url`, [id])
    if (res.rows.length === 0) {
      throw new NotFoundException('Tài liệu không tồn tại')
    }
    return { downloadUrl: res.rows[0].file_url }
  }

  private mapRowToDocument(row: any): DocumentItem {
    return {
      id: row.id,
      ownerId: row.owner_id,
      owner: {
        id: row.user_id || row.owner_id,
        username: row.user_username || 'user',
        displayName: row.user_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.user_avatar_url || null
      },
      courseId: row.course_id,
      courseCode: row.course_code || (row.tags && row.tags[0]) || null,
      title: row.title,
      description: row.description,
      type: row.type || 'pdf',
      fileUrl: row.file_url,
      fileSize: parseInt(row.file_size, 10) || 1048576,
      mimeType: row.mime_type || 'application/pdf',
      tags: row.tags || [],
      downloadCount: row.download_count || 0,
      viewCount: row.view_count || 0,
      visibility: row.visibility || 'public',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }
  }
}
