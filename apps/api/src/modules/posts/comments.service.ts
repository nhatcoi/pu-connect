import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { CreateCommentInput, CommentItem } from '@pu/schemas'

export interface CommentsResult {
  data: CommentItem[]
  total: number
  hasMore: boolean
  remainingCount: number
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name)

  constructor(private readonly db: DatabaseService) {}

  async findByPost(
    postId: string,
    currentUserId?: string,
    limit = 5,
    offset = 0
  ): Promise<CommentsResult> {
    const safeLimit = Math.min(50, Math.max(1, limit))
    const safeOffset = Math.max(0, offset)

    // 1. Get total count
    const countRes = await this.db.query(
      `SELECT COUNT(*) as total FROM comments WHERE post_id = $1`,
      [postId]
    )
    const total = parseInt(countRes.rows[0]?.total || '0', 10)

    let sql = `
      SELECT c.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points
    `
    const params: any[] = [postId]

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = c.id AND pr.user_id = $2) as is_liked_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me`
    }

    params.push(safeLimit, safeOffset)
    sql += `
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.is_solution DESC, c.created_at ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const res = await this.db.query(sql, params)
    const items = res.rows.map((row) => this.mapRowToCommentItem(row))
    const remainingCount = Math.max(0, total - (safeOffset + items.length))

    return {
      data: items,
      total,
      hasMore: remainingCount > 0,
      remainingCount
    }
  }

  async create(authorId: string, data: CreateCommentInput): Promise<CommentItem> {
    return this.db.transaction(async (client) => {
      // 1. Check if post exists with row-level lock
      const postRes = await client.query(
        `SELECT id, author_id FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [data.postId]
      )
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      // 2. Fetch author details
      const userRes = await client.query(
        `SELECT id, username, display_name, avatar_url, role, faculty, reputation_points FROM users WHERE id = $1 LIMIT 1`,
        [authorId]
      )
      if (userRes.rows.length === 0) {
        throw new NotFoundException('Người dùng không tồn tại')
      }
      const author = userRes.rows[0]

      // 3. Insert comment
      const insertRes = await client.query(
        `INSERT INTO comments (post_id, author_id, parent_id, content)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.postId, authorId, data.parentId || null, data.content]
      )

      const commentRow = insertRes.rows[0]

      // 4. Atomically update post comments count
      await client.query(
        `UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1`,
        [data.postId]
      )

      this.logger.log(`[CommentCreated] User ${authorId} commented on post ${data.postId}.`)

      return {
        id: commentRow.id,
        postId: commentRow.post_id,
        authorId: author.id,
        parentId: commentRow.parent_id || null,
        content: commentRow.content,
        mediaUrls: data.mediaUrls || [],
        likesCount: 0,
        isSolution: false,
        isLikedByMe: false,
        createdAt: commentRow.created_at.toISOString(),
        updatedAt: commentRow.updated_at ? commentRow.updated_at.toISOString() : undefined,
        author: {
          id: author.id,
          username: author.username,
          displayName: author.display_name,
          avatarUrl: author.avatar_url,
          role: author.role,
          faculty: author.faculty,
          reputationPoints: author.reputation_points || 0
        }
      }
    })
  }

  async acceptSolution(
    commentId: string,
    currentUserId: string
  ): Promise<{ isSolution: boolean; message: string }> {
    return this.db.transaction(async (client) => {
      // Find comment and post with locks
      const commentRes = await client.query(
        `SELECT c.id, c.post_id, c.author_id as comment_author_id, c.is_solution, p.author_id as post_author_id
         FROM comments c
         JOIN posts p ON c.post_id = p.id
         WHERE c.id = $1 LIMIT 1 FOR UPDATE`,
        [commentId]
      )

      if (commentRes.rows.length === 0) {
        throw new NotFoundException('Không tìm thấy bình luận')
      }

      const row = commentRes.rows[0]
      if (row.post_author_id !== currentUserId) {
        throw new UnauthorizedException('Chỉ tác giả bài viết mới có quyền duyệt câu trả lời đúng')
      }

      const newStatus = !row.is_solution

      // Reset previous solutions on this post if marking new one
      if (newStatus) {
        await client.query(
          `UPDATE comments SET is_solution = FALSE WHERE post_id = $1`,
          [row.post_id]
        )
      }

      // Update target comment
      await client.query(
        `UPDATE comments SET is_solution = $1 WHERE id = $2`,
        [newStatus, commentId]
      )

      // Update post is_resolved status
      await client.query(
        `UPDATE posts SET is_resolved = $1 WHERE id = $2`,
        [newStatus, row.post_id]
      )

      return {
        isSolution: newStatus,
        message: newStatus ? 'Đã duyệt câu trả lời chính xác' : 'Đã hủy duyệt lời giải'
      }
    })
  }

  async toggleLike(commentId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    return this.db.transaction(async (client) => {
      const check = await client.query(
        `SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
        [commentId, userId]
      )

      let isLiked = false
      if (check.rows.length > 0) {
        await client.query(
          `DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`,
          [commentId, userId]
        )
        const res = await client.query(
          `UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count`,
          [commentId]
        )
        isLiked = false
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      } else {
        await client.query(
          `INSERT INTO post_reactions (post_id, user_id, reaction) VALUES ($1, $2, 'like')`,
          [commentId, userId]
        )
        const res = await client.query(
          `UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count`,
          [commentId]
        )
        isLiked = true
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      }
    })
  }

  async delete(commentId: string, currentUserId: string, isAdmin = false): Promise<boolean> {
    return this.db.transaction(async (client) => {
      const commentRes = await client.query(
        `SELECT post_id, author_id FROM comments WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [commentId]
      )

      if (commentRes.rows.length === 0) {
        throw new NotFoundException('Không tìm thấy bình luận')
      }

      const comment = commentRes.rows[0]
      if (comment.author_id !== currentUserId && !isAdmin) {
        throw new UnauthorizedException('Bạn không có quyền xóa bình luận này')
      }

      await client.query(`DELETE FROM comments WHERE id = $1`, [commentId])
      await client.query(
        `UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1`,
        [comment.post_id]
      )

      return true
    })
  }

  private mapRowToCommentItem(row: any): CommentItem {
    return {
      id: row.id,
      postId: row.post_id,
      authorId: row.author_id,
      parentId: row.parent_id || null,
      content: row.content,
      mediaUrls: [],
      likesCount: row.likes_count || 0,
      isSolution: !!row.is_solution,
      isLikedByMe: !!row.is_liked_by_me,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      author: {
        id: row.author_user_id || row.author_id,
        username: row.author_username || 'user',
        displayName: row.author_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.author_avatar_url || null,
        role: row.author_role || 'student',
        faculty: row.author_faculty || null,
        reputationPoints: row.author_reputation_points || 100
      }
    }
  }
}
