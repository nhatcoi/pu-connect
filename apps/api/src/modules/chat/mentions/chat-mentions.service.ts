import { Injectable } from '@nestjs/common'
import type { ChatMentionedUser } from '@pu/schemas'
import { extractMentions } from '../../mentions/mention.util'
import { ChatCoreService, type Queryable } from '../chat-core.service'

// @all / @everyone: nhắc cả nhóm (chỉ trưởng nhóm)
const ALL_KEYWORDS = new Set(['all', 'everyone'])

export interface MentionResult {
  users: ChatMentionedUser[] // được nhắc đích danh (client tô sáng)
  all: boolean
  recipientIds: string[] // mọi người nhận (gồm @all) ⇒ push vượt tắt tiếng
}

const NONE: MentionResult = { users: [], all: false, recipientIds: [] }

// Nhắc tên trong nhóm chat: chỉ khớp thành viên đang ở nhóm, người thật, khác người gửi
@Injectable()
export class ChatMentionsService {
  constructor(private readonly core: ChatCoreService) {}

  // Ghi mention của 1 tin (trong transaction gửi / sửa tin); replace = sửa tin ⇒ thay toàn bộ
  async sync(
    client: Queryable,
    input: { conversationId: string; messageId: string; authorId: string; isOwner: boolean; content: string; replace?: boolean }
  ): Promise<MentionResult> {
    if (input.replace) await client.query(`DELETE FROM message_mentions WHERE message_id = $1`, [input.messageId])
    const names = extractMentions(input.content)
    const all = input.isOwner && names.some((n) => ALL_KEYWORDS.has(n))
    const usernames = names.filter((n) => !ALL_KEYWORDS.has(n))
    if (!all && !usernames.length) return NONE

    const res = await client.query(
      `WITH targets AS (
         SELECT u.id, u.username, u.username = ANY($3::text[]) AS named
         FROM conversation_members me JOIN users u ON u.id = me.user_id
         WHERE me.conversation_id = $1 AND me.left_at IS NULL AND u.account_type = 'human' AND u.id <> $2
           AND ($4 OR u.username = ANY($3::text[]))
       ), ins AS (
         INSERT INTO message_mentions (message_id, user_id, conversation_id)
         SELECT $5, id, $1 FROM targets ON CONFLICT DO NOTHING
       )
       SELECT id, username, named FROM targets`,
      [input.conversationId, input.authorId, usernames, all, input.messageId]
    )
    return {
      users: res.rows.filter((r) => r.named).map((r) => ({ id: r.id, username: r.username })),
      all,
      recipientIds: res.rows.map((r) => r.id)
    }
  }

  // Tin nhắc mình (cũ → mới) sau mốc đã đọc ⇒ nút "nhảy tới @"
  // after = mốc lúc mở hội thoại (web tự đánh dấu đã đọc ngay khi mở nên không dùng mốc hiện tại)
  async unreadIds(userId: string, conversationId: string, after?: string): Promise<string[]> {
    await this.core.assertMember(userId, conversationId)
    const res = await this.core.db.query(
      `SELECT mm.message_id FROM message_mentions mm
       JOIN conversation_members me ON me.conversation_id = mm.conversation_id AND me.user_id = mm.user_id
       JOIN messages m ON m.id = mm.message_id
       WHERE mm.user_id = $1 AND mm.conversation_id = $2 AND mm.message_id > COALESCE($3::bigint, me.last_read_message_id)
         AND m.deleted_at IS NULL
       ORDER BY mm.message_id LIMIT 50`,
      [userId, conversationId, after && /^\d+$/.test(after) ? after : null]
    )
    return res.rows.map((r) => String(r.message_id))
  }
}

// Gộp kết quả mention vào meta tin (bỏ khóa cũ khi sửa tin)
export function mentionMeta(result: MentionResult): Record<string, unknown> {
  const meta: Record<string, unknown> = {}
  if (result.users.length) meta.mentions = result.users
  if (result.all) meta.mentionAll = true
  return meta
}
