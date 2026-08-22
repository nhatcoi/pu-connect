import { Resolver, Query, Args } from '@nestjs/graphql'
import { DocumentType } from '../types/document.type'
import { DatabaseService } from '../../../database/database.service'

@Resolver(() => DocumentType)
export class DocumentResolver {
  constructor(private readonly db: DatabaseService) {}

  @Query(() => [DocumentType], { name: 'documents' })
  async getDocuments(
    @Args('faculty', { type: () => String, nullable: true }) faculty?: string,
    @Args('courseCode', { type: () => String, nullable: true }) courseCode?: string,
    @Args('type', { type: () => String, nullable: true }) type?: string
  ): Promise<DocumentType[]> {
    let sql = `
      SELECT d.*,
             d.owner_id as uploader_id,
             u.id as user_id, u.email as user_email, u.username as user_username,
             u.display_name as user_display_name, u.avatar_url as user_avatar_url,
             u.role as user_role, u.faculty as user_faculty, u.reputation_points as user_reputation_points,
             u.created_at as user_created_at
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (faculty) {
      params.push(faculty)
      sql += ` AND u.faculty = $${params.length}`
    }
    if (type) {
      params.push(type)
      sql += ` AND d.type = $${params.length}`
    }

    sql += ` ORDER BY d.download_count DESC, d.created_at DESC LIMIT 50`

    const res = await this.db.query(sql, params)

    return res.rows.map((row) => ({
      id: row.id,
      uploaderId: row.uploader_id,
      courseId: row.course_id,
      title: row.title,
      description: row.description,
      type: row.type || 'pdf',
      fileUrl: row.file_url,
      fileSize: `${((row.file_size || 1024000) / (1024 * 1024)).toFixed(1)} MB`,
      faculty: row.user_faculty,
      courseCode: row.tags && row.tags[0] ? row.tags[0] : 'IT101',
      tags: row.tags || [],
      downloadCount: row.download_count || 0,
      viewCount: row.view_count || 0,
      isVerified: true,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      uploader: {
        id: row.user_id,
        email: row.user_email || '',
        username: row.user_username || '',
        displayName: row.user_display_name || '',
        avatarUrl: row.user_avatar_url || null,
        role: row.user_role || 'student',
        faculty: row.user_faculty || null,
        reputationPoints: row.user_reputation_points || 100,
        createdAt: row.user_created_at ? new Date(row.user_created_at).toISOString() : ''
      }
    }))
  }
}
