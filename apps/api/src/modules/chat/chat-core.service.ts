import { ForbiddenException, Injectable } from '@nestjs/common'
import type { ChatMessage, ChatMessageMeta } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { MESSAGE_COLUMNS, MESSAGE_FROM, mapMessageRow } from './chat.mapper'
import { blockExistsSql } from '../blocks/blocks.sql'

// PoolClient (trong transaction) hoặc DatabaseService
export type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }

// Hạ tầng dùng chung của chat: quyền thành viên, đọc tin, phát sự kiện realtime
@Injectable()
export class ChatCoreService {
  constructor(
    readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway
  ) {}

  async isMember(userId: string, conversationId: string): Promise<boolean> {
    const res = await this.db.query(`SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL`, [
      conversationId,
      userId
    ])
    return res.rows.length > 0
  }

  async assertMember(userId: string, conversationId: string) {
    if (!(await this.isMember(userId, conversationId))) throw new ForbiddenException('Bạn không ở trong hội thoại này')
  }

  // Loại hội thoại + vai trò của mình (null nếu không phải thành viên)
  async membership(client: Queryable, userId: string, conversationId: string): Promise<{ type: string; role: string } | null> {
    const res = await client.query(
      `SELECT c.type, me.role FROM conversation_members me JOIN conversations c ON c.id = me.conversation_id
       WHERE me.conversation_id = $1 AND me.user_id = $2 AND me.left_at IS NULL`,
      [conversationId, userId]
    )
    return res.rows[0] || null
  }

  // Thành viên người thật đang ở trong hội thoại (nhận sự kiện socket)
  async memberIds(conversationId: string): Promise<string[]> {
    const res = await this.db.query(
      `SELECT me.user_id FROM conversation_members me JOIN users u ON u.id = me.user_id
       WHERE me.conversation_id = $1 AND me.left_at IS NULL AND u.account_type = 'human'`,
      [conversationId]
    )
    return res.rows.map((r) => r.user_id)
  }

  // Phát sự kiện tới mọi thành viên (room user:{id} do server cấp)
  async broadcast(conversationId: string, event: string, payload: unknown) {
    this.emitTo(await this.memberIds(conversationId), event, payload)
  }

  emitTo(userIds: string[], event: string, payload: unknown) {
    for (const id of userIds) this.realtime.emitToUser(id, event, payload)
  }

  // DM bị khóa khi một trong hai bên đã chặn người kia
  async assertDirectNotBlocked(client: Queryable, userId: string, conversationId: string) {
    const res = await client.query(
      `SELECT 1 FROM conversation_members o
       WHERE o.conversation_id = $1 AND o.user_id <> $2 AND ${blockExistsSql('$2::uuid', 'o.user_id')} LIMIT 1`,
      [conversationId, userId]
    )
    if (res.rows.length) throw new ForbiddenException('Bạn không thể nhắn tin trong cuộc trò chuyện này')
  }

  async fetchMessage(client: Queryable, messageId: string | number): Promise<ChatMessage> {
    const res = await client.query(`SELECT ${MESSAGE_COLUMNS} ${MESSAGE_FROM} WHERE m.id = $1`, [messageId])
    return mapMessageRow(res.rows[0])
  }

  async touchConversation(client: Queryable, conversationId: string, messageId: string | number) {
    await client.query(`UPDATE conversations SET last_message_id = $2, last_message_at = NOW() WHERE id = $1`, [conversationId, messageId])
  }

  // Tin hệ thống (vd. "A đã thêm B") — gọi trong transaction, phát sự kiện sau khi commit
  async insertSystem(client: Queryable, conversationId: string, actorId: string | null, content: string, meta: ChatMessageMeta): Promise<ChatMessage> {
    const ins = await client.query(`INSERT INTO messages (conversation_id, sender_id, kind, content, meta) VALUES ($1, $2, 'system', $3, $4) RETURNING id`, [
      conversationId,
      actorId,
      content,
      JSON.stringify(meta)
    ])
    await this.touchConversation(client, conversationId, ins.rows[0].id)
    return this.fetchMessage(client, ins.rows[0].id)
  }

  async displayNames(client: Queryable, ids: string[]): Promise<string[]> {
    if (!ids.length) return []
    // Giữ đúng thứ tự ids truyền vào (Preserve input order)
    const res = await client.query(`SELECT display_name FROM users WHERE id = ANY($1::uuid[]) ORDER BY array_position($1::uuid[], id)`, [ids])
    return res.rows.map((r) => r.display_name)
  }
}
