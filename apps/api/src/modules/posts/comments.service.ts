import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { MentionsService, type MentionedUser } from '../mentions/mentions.service'
import { NotificationsService } from '../notifications/notifications.service'
import { snippet, type NotifyInput } from '../notifications/notification.types'
import { blockExistsSql } from '../blocks/blocks.sql'
import type { CreateCommentInput, CommentItem } from '@pu/schemas'

export interface CommentsResult {
  data: CommentItem[]
  total: number
  hasMore: boolean
  remainingCount: number
  // Offset kế tiếp tính theo bình luận gốc (top-level)
  nextOffset: number
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mentions: MentionsService,
    private readonly notifications: NotificationsService
  ) {}

  // Phân trang theo bình luận gốc; kèm toàn bộ phản hồi của các gốc trong trang (2 cấp)
  async findByPost(
    postId: string,
    currentUserId?: string,
    limit = 5,
    offset = 0
  ): Promise<CommentsResult> {
    const safeLimit = Math.min(50, Math.max(1, limit))
    const safeOffset = Math.max(0, offset)

    // Ẩn bình luận (và nhánh trả lời) của người có quan hệ chặn với mình
    const visible = (alias: string, viewer: string) => `(${viewer}::uuid IS NULL OR NOT ${blockExistsSql(`${viewer}::uuid`, `${alias}.author_id`)})`
    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE c.parent_id IS NULL)::int AS roots
       FROM comments c WHERE c.post_id = $1 AND ${visible('c', '$2')}`,
      [postId, currentUserId ?? null]
    )
    const total = countRes.rows[0]?.total || 0
    const rootsTotal = countRes.rows[0]?.roots || 0

    const params: any[] = [postId, safeLimit, safeOffset, currentUserId ?? null]
    const likedSql = currentUserId ? `EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = c.id AND pr.user_id = $4)` : 'FALSE'

    // Recursive CTE: gốc trong trang + mọi hậu duệ (dữ liệu cũ có thể sâu > 2 cấp)
    const res = await this.db.query(
      `WITH RECURSIVE roots AS (
         SELECT r.id FROM comments r
         WHERE r.post_id = $1 AND r.parent_id IS NULL AND ${visible('r', '$4')}
         ORDER BY r.is_solution DESC, r.created_at ASC, r.id ASC
         LIMIT $2 OFFSET $3
       ), thread AS (
         SELECT id FROM roots
         UNION ALL
         SELECT c.id FROM comments c JOIN thread t ON c.parent_id = t.id WHERE ${visible('c', '$4')}
       )
       SELECT c.*,
              u.id as author_user_id, u.email as author_email, u.username as author_username,
              u.display_name as author_display_name, u.avatar_url as author_avatar_url,
              u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
              ${likedSql} as is_liked_by_me
       FROM comments c
       JOIN thread t ON t.id = c.id
       JOIN users u ON c.author_id = u.id
       ORDER BY c.parent_id IS NOT NULL, c.is_solution DESC, c.created_at ASC, c.id ASC`,
      params
    )
    const items = res.rows.map((row) => this.mapRowToCommentItem(row))
    const rootsLoaded = items.filter((c) => !c.parentId).length
    const nextOffset = safeOffset + rootsLoaded
    const remainingCount = Math.max(0, rootsTotal - nextOffset)

    return {
      data: items,
      total,
      hasMore: remainingCount > 0,
      remainingCount,
      nextOffset
    }
  }

  async create(authorId: string, data: CreateCommentInput): Promise<CommentItem> {
    let mentioned: MentionedUser[] = []
    let postAuthorId: string | null = null
    let parentAuthorId: string | null = null
    const created = await this.db.transaction(async (client) => {
      // 1. Check if post exists with row-level lock
      const postRes = await client.query(
        `SELECT id, author_id FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [data.postId]
      )
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }
      postAuthorId = postRes.rows[0].author_id

      // 1.1. Trả lời: báo tác giả bình luận được trả lời, nhưng lưu dưới bình luận gốc (tối đa 2 cấp)
      let rootId: string | null = null
      if (data.parentId) {
        const parentRes = await client.query(
          `WITH RECURSIVE up AS (
             SELECT id, parent_id, author_id, 0 AS depth FROM comments WHERE id = $1 AND post_id = $2
             UNION ALL
             SELECT c.id, c.parent_id, c.author_id, up.depth + 1 FROM comments c JOIN up ON c.id = up.parent_id
           )
           SELECT (SELECT author_id FROM up WHERE depth = 0) AS author_id,
                  (SELECT id FROM up WHERE parent_id IS NULL LIMIT 1) AS root_id`,
          [data.parentId, data.postId]
        )
        if (!parentRes.rows[0]?.author_id) throw new NotFoundException('Bình luận gốc không tồn tại')
        parentAuthorId = parentRes.rows[0].author_id
        rootId = parentRes.rows[0].root_id || data.parentId
      }

      // 1.2. Không bình luận / trả lời người có quan hệ chặn với mình
      const blocked = await client.query(
        `SELECT 1 FROM unnest($2::uuid[]) AS other(id) WHERE other.id IS NOT NULL AND ${blockExistsSql('$1::uuid', 'other.id')} LIMIT 1`,
        [authorId, [postAuthorId, parentAuthorId]]
      )
      if (blocked.rows.length) throw new ForbiddenException('Bạn không thể bình luận ở đây')

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
        [data.postId, authorId, rootId, data.content]
      )

      const commentRow = insertRes.rows[0]

      // 3.1. Ghi @mention trong cùng transaction
      mentioned = await this.mentions.record(client, 'comment', commentRow.id, authorId, data.content)

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

    // Thông báo sau khi commit; mỗi người chỉ nhận 1 loại: reply > mention > post_comment
    const link = `/post/${created.postId}?comment=${created.id}`
    const quote = snippet(created.content)
    const events: NotifyInput[] = []
    if (parentAuthorId) {
      events.push({
        type: 'comment_reply',
        recipientId: parentAuthorId,
        actorId: authorId,
        verb: 'đã trả lời bình luận của bạn',
        message: quote,
        entityType: 'post',
        entityId: created.postId,
        link
      })
    }
    events.push(
      ...this.mentions.toNotifications(mentioned, {
        sourceType: 'comment',
        sourceId: created.id,
        authorId,
        postId: created.postId,
        commentId: created.id,
        snippet: created.content
      })
    )
    if (postAuthorId) {
      events.push({
        type: 'post_comment',
        recipientId: postAuthorId,
        actorId: authorId,
        verb: 'đã bình luận về bài viết của bạn',
        message: quote,
        entityType: 'post',
        entityId: created.postId,
        link,
        groupKey: `post_comment:${created.postId}`
      })
    }
    void this.notifications.dispatch(events)
    return created
  }

  async acceptSolution(
    commentId: string,
    currentUserId: string
  ): Promise<{ isSolution: boolean; message: string }> {
    let accepted: { authorId: string; postId: string; content: string } | null = null
    const result = await this.db.transaction(async (client) => {
      // Find comment and post with locks
      const commentRes = await client.query(
        `SELECT c.id, c.post_id, c.content, c.author_id as comment_author_id, c.is_solution, p.author_id as post_author_id
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

      if (newStatus) {
        accepted = { authorId: row.comment_author_id, postId: row.post_id, content: row.content }
      }

      return {
        isSolution: newStatus,
        message: newStatus ? 'Đã duyệt câu trả lời chính xác' : 'Đã hủy duyệt lời giải'
      }
    })

    if (accepted) {
      const { authorId, postId, content } = accepted
      void this.notifications.dispatch([
        {
          type: 'accepted_solution',
          recipientId: authorId,
          actorId: currentUserId,
          verb: 'đã chọn câu trả lời của bạn làm lời giải',
          message: snippet(content),
          entityType: 'post',
          entityId: postId,
          link: `/post/${postId}?comment=${commentId}`
        }
      ])
    }
    return result
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

      // ON DELETE CASCADE xóa cả phản hồi ⇒ trừ đúng số dòng bị xóa
      const removed = await client.query(
        `WITH RECURSIVE thread AS (
           SELECT id FROM comments WHERE id = $1
           UNION ALL
           SELECT c.id FROM comments c JOIN thread t ON c.parent_id = t.id
         )
         SELECT COUNT(*)::int AS c FROM thread`,
        [commentId]
      )
      await client.query(`DELETE FROM comments WHERE id = $1`, [commentId])
      await client.query(
        `UPDATE posts SET comments_count = GREATEST(0, comments_count - $2) WHERE id = $1`,
        [comment.post_id, removed.rows[0]?.c || 1]
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
