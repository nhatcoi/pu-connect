import { Injectable, BadRequestException, NotFoundException, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { setTrashActor } from '../../database/trash'
import { MentionsService, type MentionedUser } from '../mentions/mentions.service'
import { NotificationsService } from '../notifications/notifications.service'
import { snippet, type NotifyInput } from '../notifications/notification.types'
import { blockExistsSql } from '../blocks/blocks.sql'
import type { CreateCommentInput, CommentItem } from '@pu/schemas'
import type { ReportCommentBody } from './dto/comment.dto'
import { anonymousAuthor, anonymizeNotification, assertAnonymousQuota } from './anonymity'
import { ModerationService } from '../moderation/moderation.service'
import { PostDocumentsService } from '../documents/post-documents.service'
import { fieldNameSql } from '../units/unit-sql'
import { commentShownSql, HELD_REASON_PREFIX, REJECTED_REASON } from './comment-access.sql'

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
    private readonly notifications: NotificationsService,
    private readonly moderation: ModerationService,
    private readonly documents: PostDocumentsService
  ) {}

  // Phân trang theo bình luận gốc; kèm toàn bộ phản hồi của các gốc trong trang (2 cấp)
  async findByPost(postId: string, currentUserId?: string, limit = 5, offset = 0): Promise<CommentsResult> {
    const safeLimit = Math.min(50, Math.max(1, limit))
    const safeOffset = Math.max(0, offset)

    // Ẩn bình luận (và nhánh trả lời) của người có quan hệ chặn với mình, và bình luận đang chờ duyệt của người khác
    const visible = (alias: string, viewer: string) =>
      `(${viewer}::uuid IS NULL OR NOT ${blockExistsSql(`${viewer}::uuid`, `${alias}.author_id`)}) AND ${commentShownSql(alias, viewer)}`
    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE c.parent_id IS NULL)::int AS roots
       FROM comments c WHERE c.post_id = $1 AND ${visible('c', '$2')}`,
      [postId, currentUserId ?? null]
    )
    const total = countRes.rows[0]?.total || 0
    const rootsTotal = countRes.rows[0]?.roots || 0

    const params: any[] = [postId, safeLimit, safeOffset, currentUserId ?? null]
    const likedSql = currentUserId ? `EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.user_id = $4)` : 'FALSE'

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
              u.role as author_role, ${fieldNameSql('u')} as author_interest_field, u.reputation_points as author_reputation_points,
              ${likedSql} as is_liked_by_me
       FROM comments c
       JOIN thread t ON t.id = c.id
       JOIN users u ON c.author_id = u.id
       ORDER BY c.parent_id IS NOT NULL, c.is_solution DESC, c.created_at ASC, c.id ASC`,
      params
    )
    const items = res.rows.map((row) => this.mapRowToCommentItem(row, currentUserId))
    const docs = await this.documents.forComments(
      items.map((c) => c.id),
      currentUserId
    )
    for (const c of items) c.documents = docs.get(c.id) ?? []
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
    const anonymous = !!data.isAnonymous
    // block ⇒ từ chối; flag/hold ⇒ lưu nhưng chờ admin duyệt (chỉ tác giả thấy, chưa đếm, chưa báo ai)
    const verdict = await this.moderation.check({ text: data.content, userId: authorId, surface: 'comment' })
    if (verdict.action === 'block') throw new BadRequestException('Nội dung chứa ngôn từ không phù hợp với quy tắc cộng đồng')
    const held = verdict.action === 'hold' || verdict.action === 'flag'
    const created = await this.db.transaction(async (client) => {
      // 1. Check if post exists with row-level lock
      const postRes = await client.query(`SELECT id, author_id FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`, [data.postId])
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

      // 1.3. Ẩn danh: có hạn mức 24h
      if (anonymous) await assertAnonymousQuota(client, 'comments', authorId)

      // 2. Fetch author details
      const userRes = await client.query(`SELECT id, username, display_name, avatar_url, role, ${fieldNameSql('users')} AS interest_field, reputation_points FROM users WHERE id = $1 LIMIT 1`, [
        authorId
      ])
      if (userRes.rows.length === 0) {
        throw new NotFoundException('Người dùng không tồn tại')
      }
      const author = userRes.rows[0]

      // 3. Insert comment
      const insertRes = await client.query(
        `INSERT INTO comments (post_id, author_id, parent_id, content, is_anonymous, hidden_at, hidden_reason)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::boolean THEN NOW() END, $7)
         RETURNING *`,
        [data.postId, authorId, rootId, data.content, anonymous, held, held ? `${HELD_REASON_PREFIX} ${verdict.reason}` : null]
      )

      const commentRow = insertRes.rows[0]

      // 3.0. Tài liệu đính kèm (bản nháp đã tải lên) ⇒ published + comment_documents
      const documentIds = Array.isArray(data.documentIds) ? data.documentIds : []
      await this.documents.attachToComment(client, commentRow.id, data.postId, authorId, documentIds)
      const attached = documentIds.length ? ((await this.documents.forComments([commentRow.id], authorId, client)).get(commentRow.id) ?? []) : []

      // 3.1. Ghi @mention trong cùng transaction
      mentioned = await this.mentions.record(client, 'comment', commentRow.id, authorId, data.content)

      // 4. Atomically update post comments count (bình luận chờ duyệt chưa đếm)
      if (!held) await client.query(`UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1`, [data.postId])

      this.logger.log(`[CommentCreated] User ${authorId} commented on post ${data.postId}.`)

      return {
        id: commentRow.id,
        postId: commentRow.post_id,
        authorId: anonymous ? anonymousAuthor().id : author.id,
        isAnonymous: anonymous,
        isMine: true,
        parentId: commentRow.parent_id || null,
        content: commentRow.content,
        mediaUrls: data.mediaUrls || [],
        documents: attached,
        likesCount: 0,
        isSolution: false,
        isLikedByMe: false,
        createdAt: commentRow.created_at.toISOString(),
        updatedAt: commentRow.updated_at ? commentRow.updated_at.toISOString() : undefined,
        editedAt: null,
        moderationStatus: held ? ('pending' as const) : undefined,
        author: anonymous
          ? anonymousAuthor()
          : {
              id: author.id,
              username: author.username,
              displayName: author.display_name,
              avatarUrl: author.avatar_url,
              role: author.role,
              interestField: author.interest_field,
              reputationPoints: author.reputation_points || 0
            }
      }
    })

    void this.moderation.attachTarget(verdict.eventId, 'comment', created.id)
    // Chờ duyệt: chưa báo ai (chủ bài, người được trả lời, @mention) cho tới khi admin duyệt
    if (held) return created
    this.notifyCreated(created, { authorId, anonymous, postAuthorId, parentAuthorId, mentioned })
    return created
  }

  // Thông báo sau khi commit; mỗi người chỉ nhận 1 loại: reply > mention > post_comment
  private notifyCreated(
    created: Pick<CommentItem, 'id' | 'postId' | 'content'>,
    ctx: { authorId: string; anonymous: boolean; postAuthorId: string | null; parentAuthorId: string | null; mentioned: MentionedUser[] }
  ): void {
    const { authorId, anonymous, postAuthorId, parentAuthorId, mentioned } = ctx
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
    // Ẩn danh: mọi thông báo phát sinh không nêu người gửi
    void this.notifications.dispatch(anonymous ? events.map(anonymizeNotification) : events)
  }

  async acceptSolution(commentId: string, currentUserId: string): Promise<{ isSolution: boolean; message: string }> {
    let accepted: { authorId: string; postId: string; content: string; anonymousPost: boolean } | null = null
    const result = await this.db.transaction(async (client) => {
      // Find comment and post with locks
      const commentRes = await client.query(
        `SELECT c.id, c.post_id, c.content, c.author_id as comment_author_id, c.is_solution, p.author_id as post_author_id, p.is_anonymous as post_is_anonymous
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
        await client.query(`UPDATE comments SET is_solution = FALSE WHERE post_id = $1`, [row.post_id])
      }

      // Update target comment
      await client.query(`UPDATE comments SET is_solution = $1 WHERE id = $2`, [newStatus, commentId])

      // Update post is_resolved status
      await client.query(`UPDATE posts SET is_resolved = $1 WHERE id = $2`, [newStatus, row.post_id])

      if (newStatus) {
        accepted = { authorId: row.comment_author_id, postId: row.post_id, content: row.content, anonymousPost: !!row.post_is_anonymous }
      }

      return {
        isSolution: newStatus,
        message: newStatus ? 'Đã duyệt câu trả lời chính xác' : 'Đã hủy duyệt lời giải'
      }
    })

    if (accepted) {
      const { authorId, postId, content, anonymousPost } = accepted
      const event: NotifyInput = {
        type: 'accepted_solution',
        recipientId: authorId,
        actorId: currentUserId,
        verb: 'đã chọn câu trả lời của bạn làm lời giải',
        message: snippet(content),
        entityType: 'post',
        entityId: postId,
        link: `/post/${postId}?comment=${commentId}`
      }
      // Bài ẩn danh: người nhận không được biết ai là chủ bài
      void this.notifications.dispatch([anonymousPost ? anonymizeNotification(event) : event])
    }
    return result
  }

  // Thích / bỏ thích bình luận (comment_reactions); khóa dòng comment ⇒ đếm đúng khi bấm liên tục
  // Toggle comment like; row lock on the comment serializes concurrent toggles
  async toggleLike(commentId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    let target: { author_id: string; post_id: string; content: string } | undefined
    const result = await this.db.transaction(async (client) => {
      const found = await client.query(`SELECT author_id, post_id, content FROM comments WHERE id = $1 FOR UPDATE`, [commentId])
      if (!found.rowCount) throw new NotFoundException('Không tìm thấy bình luận')
      target = found.rows[0]

      const removed = await client.query(`DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2`, [commentId, userId])
      const isLiked = !removed.rowCount
      if (isLiked) await client.query(`INSERT INTO comment_reactions (comment_id, user_id) VALUES ($1, $2)`, [commentId, userId])
      const res = await client.query(
        `UPDATE comments SET likes_count = GREATEST(0, likes_count + $2) WHERE id = $1 RETURNING likes_count`,
        [commentId, isLiked ? 1 : -1]
      )
      return { isLiked, likesCount: res.rows[0]?.likes_count ?? 0 }
    })
    // Gộp: "A và N người khác đã thích bình luận của bạn" (chỉ khi thích, không khi bỏ thích)
    if (result.isLiked && target) {
      void this.notifications.dispatch([
        {
          type: 'comment_like',
          recipientId: target.author_id,
          actorId: userId,
          verb: 'đã thích bình luận của bạn',
          message: snippet(target.content),
          entityType: 'post',
          entityId: target.post_id,
          link: `/post/${target.post_id}?comment=${commentId}`,
          groupKey: `comment_like:${commentId}`
        }
      ])
    }
    return result
  }

  // Sửa nội dung + ghi mention mới trong cùng transaction
  async update(commentId: string, currentUserId: string, content: string): Promise<{ id: string; content: string; editedAt: string }> {
    let mentioned: MentionedUser[] = []
    // Sửa cũng phải qua kiểm duyệt: từ cấm nặng bị từ chối (không để lách bằng cách đăng sạch rồi sửa)
    const verdict = await this.moderation.check({ text: content, userId: currentUserId, surface: 'comment' })
    if (verdict.action === 'block') throw new BadRequestException('Nội dung chứa ngôn từ không phù hợp với quy tắc cộng đồng')
    const updated = await this.db.transaction(async (client) => {
      const res = await client.query(`SELECT post_id, author_id, is_anonymous, hidden_at FROM comments WHERE id = $1 LIMIT 1 FOR UPDATE`, [commentId])
      const row = res.rows[0]
      if (!row) throw new NotFoundException('Không tìm thấy bình luận')
      if (row.author_id !== currentUserId) throw new ForbiddenException('Bạn chỉ sửa được bình luận của mình')
      if (row.hidden_at) throw new ForbiddenException('Bình luận đang chờ duyệt, chưa thể chỉnh sửa')

      const upd = await client.query(
        `UPDATE comments SET content = $2, edited_at = NOW(), updated_at = NOW()
         WHERE id = $1 RETURNING content, edited_at`,
        [commentId, content]
      )
      mentioned = await this.mentions.record(client, 'comment', commentId, currentUserId, content)
      return {
        id: commentId,
        postId: row.post_id as string,
        isAnonymous: !!row.is_anonymous,
        content: upd.rows[0].content as string,
        editedAt: (upd.rows[0].edited_at as Date).toISOString()
      }
    })

    const editMentions = this.mentions.toNotifications(mentioned, {
      sourceType: 'comment',
      sourceId: commentId,
      authorId: currentUserId,
      postId: updated.postId,
      commentId,
      snippet: updated.content
    })
    void this.notifications.dispatch(updated.isAnonymous ? editMentions.map(anonymizeNotification) : editMentions)
    return { id: updated.id, content: updated.content, editedAt: updated.editedAt }
  }

  // Báo cáo bình luận: không tự báo cáo, không báo cáo trùng khi báo cáo cũ còn chờ
  async report(commentId: string, reporterId: string, data: ReportCommentBody): Promise<{ success: boolean }> {
    const res = await this.db.query(`SELECT author_id FROM comments WHERE id = $1 LIMIT 1`, [commentId])
    if (res.rows.length === 0) throw new NotFoundException('Không tìm thấy bình luận')
    if (res.rows[0].author_id === reporterId) throw new ForbiddenException('Không thể báo cáo bình luận của chính bạn')
    await this.db.query(
      `INSERT INTO comment_reports (comment_id, reporter_id, reason, details) VALUES ($1, $2, $3, $4)
       ON CONFLICT (comment_id, reporter_id) WHERE status = 'pending' DO NOTHING`,
      [commentId, reporterId, data.reason ?? 'other', data.details || null]
    )
    return { success: true }
  }

  async delete(commentId: string, currentUserId: string, isAdmin = false): Promise<boolean> {
    return this.db.transaction(async (client) => {
      const commentRes = await client.query(`SELECT post_id, author_id FROM comments WHERE id = $1 LIMIT 1 FOR UPDATE`, [commentId])

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
           SELECT id, hidden_at FROM comments WHERE id = $1
           UNION ALL
           SELECT c.id, c.hidden_at FROM comments c JOIN thread t ON c.parent_id = t.id
         )
         SELECT COUNT(*) FILTER (WHERE hidden_at IS NULL)::int AS c FROM thread`,
        [commentId]
      )
      await setTrashActor(client, currentUserId)
      await client.query(`DELETE FROM comments WHERE id = $1`, [commentId])
      await client.query(`UPDATE posts SET comments_count = GREATEST(0, comments_count - $2) WHERE id = $1`, [comment.post_id, removed.rows[0]?.c ?? 0])

      return true
    })
  }

  /**
   * Admin duyệt bình luận đang chờ: hiện lại, tính vào comments_count và báo các bên đã bị hoãn
   * (chủ bài, người được trả lời, @mention) cùng tác giả. Trả về false nếu bình luận không còn chờ duyệt.
   */
  async approveHeld(commentId: string): Promise<boolean> {
    const released = await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE comments SET hidden_at = NULL, hidden_reason = NULL
         WHERE id = $1 AND hidden_at IS NOT NULL AND hidden_reason LIKE $2
         RETURNING id, post_id, author_id, parent_id, content, is_anonymous`,
        [commentId, `${HELD_REASON_PREFIX}%`]
      )
      const row = res.rows[0]
      if (!row) return null
      await client.query(`UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1`, [row.post_id])
      const post = await client.query(`SELECT author_id FROM posts WHERE id = $1`, [row.post_id])
      // parent_id luôn là bình luận gốc của nhánh ⇒ báo tác giả gốc (không còn biết chính xác người được trả lời)
      const parent = row.parent_id ? await client.query(`SELECT author_id FROM comments WHERE id = $1`, [row.parent_id]) : null
      const mentions = await client.query(
        `SELECT u.id, u.username, u.account_type FROM mentions m JOIN users u ON u.id = m.mentioned_user_id
         WHERE m.source_type = 'comment' AND m.source_id = $1`,
        [commentId]
      )
      return {
        row,
        postAuthorId: (post.rows[0]?.author_id as string | undefined) ?? null,
        parentAuthorId: (parent?.rows[0]?.author_id as string | undefined) ?? null,
        mentioned: mentions.rows.map((m): MentionedUser => ({ id: m.id, username: m.username, accountType: m.account_type }))
      }
    })
    if (!released) return false

    const { row, postAuthorId, parentAuthorId, mentioned } = released
    this.notifyCreated(
      { id: row.id, postId: row.post_id, content: row.content },
      { authorId: row.author_id, anonymous: !!row.is_anonymous, postAuthorId, parentAuthorId, mentioned }
    )
    void this.notifications.dispatch([
      {
        type: 'account_notice',
        recipientId: row.author_id,
        actorId: null,
        verb: 'Bình luận của bạn đã được quản trị viên duyệt và hiển thị',
        message: snippet(row.content),
        entityType: 'post',
        entityId: row.post_id,
        link: `/post/${row.post_id}?comment=${row.id}`
      }
    ])
    return true
  }

  /** Admin xác nhận vi phạm: bình luận vẫn ẩn với mọi người, tác giả thấy trạng thái "bị từ chối". */
  async rejectHeld(commentId: string): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE comments SET hidden_reason = $3
       WHERE id = $1 AND hidden_at IS NOT NULL AND hidden_reason LIKE $2
       RETURNING author_id, post_id, content`,
      [commentId, `${HELD_REASON_PREFIX}%`, REJECTED_REASON]
    )
    const row = res.rows[0]
    if (!row) return false
    void this.notifications.dispatch([
      {
        type: 'account_notice',
        recipientId: row.author_id,
        actorId: null,
        verb: 'Bình luận của bạn không được duyệt vì vi phạm quy tắc cộng đồng',
        message: snippet(row.content),
        entityType: 'post',
        entityId: row.post_id,
        link: `/post/${row.post_id}`
      }
    ])
    return true
  }

  // Bình luận ẩn danh: che tác giả với mọi người; isMine cho chủ bình luận tự nhận ra
  private mapRowToCommentItem(row: any, viewerId?: string): CommentItem {
    const anonymous = !!row.is_anonymous
    return {
      id: row.id,
      postId: row.post_id,
      authorId: anonymous ? anonymousAuthor().id : row.author_id,
      isAnonymous: anonymous,
      isMine: !!viewerId && row.author_id === viewerId,
      parentId: row.parent_id || null,
      content: row.content,
      mediaUrls: [],
      likesCount: row.likes_count || 0,
      isSolution: !!row.is_solution,
      isLikedByMe: !!row.is_liked_by_me,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
      moderationStatus: row.hidden_at ? (row.hidden_reason === REJECTED_REASON ? 'rejected' : 'pending') : undefined,
      author: anonymous
        ? anonymousAuthor()
        : {
            id: row.author_user_id || row.author_id,
            username: row.author_username || 'user',
            displayName: row.author_display_name || 'Sinh viên Phenikaa',
            avatarUrl: row.author_avatar_url || null,
            role: row.author_role || 'student',
            interestField: row.author_interest_field || null,
            reputationPoints: row.author_reputation_points || 100
          }
    }
  }
}
