import { Injectable } from '@nestjs/common'
import type { PoolClient } from 'pg'
import { snippet, type NotifyInput } from '../notifications/notification.types'
import { extractMentions } from './mention.util'

export type MentionSourceType = 'post' | 'comment' | 'message'

export interface MentionedUser {
  id: string
  username: string
  accountType: 'human' | 'bot' | 'system'
}

export interface MentionContext {
  sourceType: MentionSourceType
  sourceId: string
  authorId: string
  postId: string // điều hướng thông báo về bài viết
  commentId?: string
  snippet: string
}

@Injectable()
export class MentionsService {
  // Ghi mention trong cùng transaction với post/comment; chỉ trả về mention MỚI
  // (sửa bài không thông báo lại người đã được nhắc)
  async record(
    client: PoolClient,
    sourceType: MentionSourceType,
    sourceId: string,
    authorId: string,
    ...texts: (string | null | undefined)[]
  ): Promise<MentionedUser[]> {
    const usernames = extractMentions(...texts)
    if (usernames.length === 0) return []

    const res = await client.query(
      `WITH targets AS (
         SELECT id, username, account_type FROM users
         WHERE username = ANY($1::text[]) AND id <> $2 AND status = 'active'
       ), inserted AS (
         INSERT INTO mentions (source_type, source_id, mentioned_user_id, author_id)
         SELECT $3, $4, id, $2 FROM targets
         ON CONFLICT DO NOTHING
         RETURNING mentioned_user_id
       )
       SELECT t.id, t.username, t.account_type
       FROM targets t JOIN inserted i ON i.mentioned_user_id = t.id`,
      [usernames, authorId, sourceType, sourceId]
    )
    return res.rows.map((r) => ({ id: r.id, username: r.username, accountType: r.account_type }))
  }

  // Thông báo user_mention cho người thật; bot (@puai) do AI layer xử lý (P3)
  toNotifications(mentioned: MentionedUser[], ctx: MentionContext): NotifyInput[] {
    const where = ctx.sourceType === 'comment' ? 'một bình luận' : 'một bài viết'
    const link = ctx.commentId ? `/post/${ctx.postId}?comment=${ctx.commentId}` : `/post/${ctx.postId}`
    return mentioned
      .filter((m) => m.accountType === 'human')
      .map((m) => ({
        type: 'user_mention',
        recipientId: m.id,
        actorId: ctx.authorId,
        verb: `đã nhắc đến bạn trong ${where}`,
        message: snippet(ctx.snippet),
        entityType: 'post',
        entityId: ctx.postId,
        link
      }))
  }
}
