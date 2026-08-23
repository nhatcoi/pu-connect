import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { CreatePostInput, PostItem } from '@pu/schemas'

export interface FeedResult {
  data: PostItem[]
  total: number
  hasMore: boolean
  nextOffset: number
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name)

  constructor(private readonly db: DatabaseService) {}

  async findAll(
    currentUserId?: string,
    tag?: string,
    limit = 10,
    offset = 0,
    feedType = 'for_you'
  ): Promise<FeedResult> {
    const safeLimit = Math.min(50, Math.max(1, limit))
    const safeOffset = Math.max(0, offset)

    let scoreCalculation = `0.0`
    let joins = ` FROM posts p JOIN users u ON p.author_id = u.id LEFT JOIN courses c ON p.course_id = c.id`

    const params: any[] = []

    if (currentUserId) {
      params.push(currentUserId)
      joins += ` LEFT JOIN users cu ON cu.id = $1`

      scoreCalculation = `(
        (CASE WHEN p.is_pinned THEN 1000.0 ELSE 0.0 END)
        + (CASE WHEN u.faculty IS NOT NULL AND cu.faculty IS NOT NULL AND u.faculty = cu.faculty THEN 30.0 ELSE 0.0 END)
        + (CASE WHEN u.academic_year IS NOT NULL AND cu.academic_year IS NOT NULL AND u.academic_year = cu.academic_year THEN 15.0 ELSE 0.0 END)
        + (CASE WHEN EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = cu.id AND uf.following_id = p.author_id) THEN 35.0 ELSE 0.0 END)
        + (CASE WHEN cu.interests IS NOT NULL AND array_length(cu.interests, 1) > 0 AND p.tags && cu.interests THEN 35.0 ELSE 0.0 END)
        + (CASE WHEN cu.skills IS NOT NULL AND array_length(cu.skills, 1) > 0 AND p.tags && cu.skills THEN 25.0 ELSE 0.0 END)
        + (CASE WHEN p.is_resolved THEN 10.0 ELSE 0.0 END)
        + (p.likes_count * 2.0 + p.comments_count * 5.0)
        - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0 * 2.0)
      )`
    } else {
      scoreCalculation = `(
        (CASE WHEN p.is_pinned THEN 1000.0 ELSE 0.0 END)
        + (CASE WHEN p.is_resolved THEN 10.0 ELSE 0.0 END)
        + (p.likes_count * 2.0 + p.comments_count * 5.0)
        - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0 * 2.0)
      )`
    }

    let whereClause = ` WHERE 1=1`

    if (tag) {
      params.push(tag)
      whereClause += ` AND $${params.length} = ANY(p.tags)`
    }

    if (feedType === 'courses') {
      whereClause += ` AND (p.course_id IS NOT NULL OR p.post_type IN ('qa', 'document'))`
    }

    // 1. Get total count
    const countSql = `SELECT COUNT(*) as total ${joins} ${whereClause}`
    const countRes = await this.db.query(countSql, params)
    const total = parseInt(countRes.rows[0]?.total || '0', 10)

    // 2. Query posts with score
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name,
             ${scoreCalculation} as recommendation_score
    `

    if (currentUserId) {
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1) as is_liked_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me`
    }

    sql += `${joins} ${whereClause}`

    params.push(safeLimit, safeOffset)
    sql += ` ORDER BY recommendation_score DESC, p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

    const res = await this.db.query(sql, params)
    const items = res.rows.map((row) => this.mapRowToPostItem(row))

    return {
      data: items,
      total,
      hasMore: safeOffset + items.length < total,
      nextOffset: safeOffset + items.length
    }
  }

  async findOne(id: string, currentUserId?: string): Promise<PostItem> {
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name
    `
    const params: any[] = [id]

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $2) as is_liked_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me`
    }

    sql += ` FROM posts p JOIN users u ON p.author_id = u.id LEFT JOIN courses c ON p.course_id = c.id WHERE p.id = $1 LIMIT 1`

    const res = await this.db.query(sql, params)
    if (res.rows.length === 0) {
      throw new NotFoundException(`Bài viết không tồn tại (ID: ${id})`)
    }
    return this.mapRowToPostItem(res.rows[0])
  }

  async create(authorId: string, data: CreatePostInput): Promise<PostItem> {
    return this.db.transaction(async (client) => {
      // 1. Resolve author details from PostgreSQL
      const userRes = await client.query(
        `SELECT id, username, display_name, avatar_url, faculty, reputation_points FROM users WHERE id = $1 LIMIT 1`,
        [authorId]
      )

      if (userRes.rows.length === 0) {
        throw new NotFoundException('Tài khoản người dùng không tồn tại')
      }
      const authorUser = userRes.rows[0]

      // 2. Resolve course_id and course_code if string was passed
      let courseUuid: string | null = null
      let courseCode: string | null = null
      let courseName: string | null = null

      if (data.courseId) {
        const courseRes = await client.query(
          `SELECT id, code, name FROM courses WHERE id::text = $1 OR code ILIKE $1 LIMIT 1`,
          [data.courseId]
        )
        if (courseRes.rows.length > 0) {
          courseUuid = courseRes.rows[0].id
          courseCode = courseRes.rows[0].code
          courseName = courseRes.rows[0].name
        }
      }

      // 3. Insert Post into PostgreSQL
      const insertRes = await client.query(
        `INSERT INTO posts (
          author_id, course_id, post_type, title, content, tags, media_urls, attached_document_ids, visibility
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          authorId,
          courseUuid,
          data.postType || 'general',
          data.title || data.content.slice(0, 50),
          data.content,
          data.tags || [],
          data.mediaUrls || [],
          data.attachedDocumentIds || [],
          data.visibility || 'public'
        ]
      )

      const postRow = insertRes.rows[0]

      // 4. Atomically reward +5 reputation points for author
      await client.query(
        `UPDATE users SET reputation_points = reputation_points + 5 WHERE id = $1`,
        [authorId]
      )

      // 5. Atomically increment post_count for course if attached
      if (courseUuid) {
        await client.query(
          `UPDATE courses SET post_count = post_count + 1 WHERE id = $1`,
          [courseUuid]
        )
      }

      this.logger.log(
        `[PostCreatedEvent] Post ${postRow.id} created by user ${authorId} in ACID transaction (+5 rep).`
      )

      return {
        id: postRow.id,
        authorId: authorUser.id,
        author: {
          id: authorUser.id,
          username: authorUser.username,
          displayName: authorUser.display_name,
          avatarUrl: authorUser.avatar_url
        },
        title: postRow.title,
        content: postRow.content,
        postType: postRow.post_type || 'general',
        courseId: courseUuid,
        courseCode,
        courseName,
        facultyCode: authorUser.faculty,
        targetAudience: data.targetAudience || 'everyone',
        isResolved: postRow.is_resolved || false,
        recruitSlotsTotal: data.recruitSlotsTotal,
        recruitSlotsFilled: data.recruitSlotsFilled,
        tags: postRow.tags || [],
        mediaUrls: postRow.media_urls || [],
        attachedDocumentIds: postRow.attached_document_ids || [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLikedByMe: false,
        createdAt: postRow.created_at.toISOString(),
        updatedAt: postRow.updated_at.toISOString()
      }
    })
  }

  async toggleLike(postId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    return this.db.transaction(async (client) => {
      const check = await client.query(
        `SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
        [postId, userId]
      )

      let isLiked = false
      if (check.rows.length > 0) {
        await client.query(
          `DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`,
          [postId, userId]
        )
        const res = await client.query(
          `UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count`,
          [postId]
        )
        isLiked = false
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      } else {
        await client.query(
          `INSERT INTO post_reactions (post_id, user_id, reaction) VALUES ($1, $2, 'like')`,
          [postId, userId]
        )
        const res = await client.query(
          `UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count`,
          [postId]
        )
        isLiked = true
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      }
    })
  }

  private mapRowToPostItem(row: any): PostItem {
    return {
      id: row.id,
      authorId: row.author_id,
      author: {
        id: row.author_user_id || row.author_id,
        username: row.author_username || 'user',
        displayName: row.author_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.author_avatar_url || null
      },
      title: row.title,
      content: row.content,
      postType: row.post_type || 'general',
      courseId: row.course_id,
      courseCode: row.course_code || null,
      courseName: row.course_name || null,
      facultyCode: row.faculty_code || row.author_faculty || null,
      targetAudience: 'everyone',
      isResolved: row.is_resolved || false,
      tags: row.tags || [],
      mediaUrls: row.media_urls || [],
      attachedDocumentIds: row.attached_document_ids || [],
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      sharesCount: row.shares_count || 0,
      isLikedByMe: row.is_liked_by_me || false,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }
  }
}
