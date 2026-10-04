import { Injectable, Logger } from '@nestjs/common'
import type { PoolClient } from 'pg'
import { NotificationsService } from '../notifications/notifications.service'
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
  authorName: string
  postId: string // điều hướng thông báo về bài viết
  snippet: string
}

@Injectable()
export class MentionsService {
  private readonly logger = new Logger(MentionsService.name)

  constructor(private readonly notifications: NotificationsService) {}

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

  // Gửi thông báo sau khi transaction commit; bot (@puai) được xử lý bởi AI layer (P3)
  async notify(mentioned: MentionedUser[], ctx: MentionContext): Promise<void> {
    const humans = mentioned.filter((m) => m.accountType === 'human')
    const where = ctx.sourceType === 'comment' ? 'một bình luận' : 'một bài viết'
    await Promise.all(
      humans.map((m) =>
        this.notifications
          .createNotification({
            recipientId: m.id,
            actorId: ctx.authorId,
            type: 'user_mention',
            title: `${ctx.authorName} đã nhắc đến bạn`,
            message: `Trong ${where}: "${ctx.snippet.slice(0, 120)}"`,
            entityId: ctx.postId,
            entityType: 'post'
          })
          .catch((err) => this.logger.error(`Mention notify failed (${m.username}): ${err?.message}`))
      )
    )
  }
}
