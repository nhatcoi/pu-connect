import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  ChatMessage,
  ChatUser,
  ConversationSummary,
  CreateGroupChatInput,
  MessagesPage,
  SendMessageInput
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { SimpleRateLimiter } from '../auth/rate-limit.util'
import { PuaiService } from './puai.service'

// Cột tin nhắn + người gửi (alias m = messages, s = users)
export const MESSAGE_COLUMNS = `
  m.id, m.conversation_id, m.client_msg_id, m.kind, m.content, m.blocks, m.reply_to_id, m.status,
  m.deleted_at, m.created_at,
  s.id AS s_id, s.username AS s_username, s.display_name AS s_display_name, s.avatar_url AS s_avatar_url,
  s.account_type AS s_account_type`

export function mapMessageRow(row: any): ChatMessage {
  const deleted = !!row.deleted_at
  return {
    id: String(row.id),
    conversationId: row.conversation_id,
    sender: row.s_id
      ? {
          id: row.s_id,
          username: row.s_username,
          displayName: row.s_display_name,
          avatarUrl: row.s_avatar_url,
          isBot: row.s_account_type === 'bot'
        }
      : null,
    clientMsgId: row.client_msg_id,
    kind: row.kind,
    // Tin đã thu hồi: không trả nội dung
    content: deleted ? '' : row.content || '',
    blocks: deleted ? null : row.blocks,
    replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
    status: row.status,
    deleted,
    createdAt: new Date(row.created_at).toISOString()
  }
}

// PoolClient (trong transaction) hoặc DatabaseService
type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }

const MAX_GROUP_MEMBERS = 50

@Injectable()
export class ChatService {
  // 20 tin / 10 giây / user; tạo nhóm 10 / ngày
  private readonly sendLimiter = new SimpleRateLimiter(20, 10_000)
  private readonly groupLimiter = new SimpleRateLimiter(10, 86_400_000)

  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
    @Inject(forwardRef(() => PuaiService)) private readonly puai: PuaiService
  ) {}

  // Danh sách hội thoại: PU AI ghim đầu, còn lại theo tin mới nhất
  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const res = await this.db.query(
      `${this.summarySelect()}
       WHERE me.user_id = $1 AND me.left_at IS NULL
       ORDER BY (c.type = 'ai') DESC, COALESCE(c.last_message_at, c.created_at) DESC
       LIMIT 100`,
      [userId]
    )
    return res.rows.map((r) => this.mapSummary(r))
  }

  async getConversation(userId: string, conversationId: string): Promise<ConversationSummary> {
    const res = await this.db.query(
      `${this.summarySelect()} WHERE me.user_id = $1 AND me.left_at IS NULL AND c.id = $2`,
      [userId, conversationId]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy hội thoại')
    return this.mapSummary(res.rows[0])
  }

  // Tổng tin chưa đọc (badge "Tin nhắn")
  async unreadTotal(userId: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COALESCE(SUM(LEAST(x.n, 99)), 0)::int AS total FROM (
         SELECT (SELECT COUNT(*) FROM messages m
                 WHERE m.conversation_id = me.conversation_id AND m.id > me.last_read_message_id
                   AND m.deleted_at IS NULL AND m.sender_id IS DISTINCT FROM $1) AS n
         FROM conversation_members me WHERE me.user_id = $1 AND me.left_at IS NULL
       ) x`,
      [userId]
    )
    return res.rows[0].total
  }

  // Mở (hoặc tạo) DM 1-1: direct_key duy nhất mỗi cặp ⇒ idempotent
  async openDirect(userId: string, targetId: string): Promise<ConversationSummary> {
    if (userId === targetId) throw new BadRequestException('Không thể nhắn tin cho chính mình')
    const target = await this.db.query(`SELECT id, account_type, status FROM users WHERE id = $1`, [targetId])
    const t = target.rows[0]
    if (!t) throw new NotFoundException('Người dùng không tồn tại')
    if (t.account_type === 'bot') return this.openAi(userId)
    if (t.account_type !== 'human' || t.status === 'suspended') {
      throw new ForbiddenException('Không thể nhắn tin cho tài khoản này')
    }
    await this.assertCanStartChat(userId)

    const key = [userId, targetId].sort().join(':')
    const id = await this.db.transaction(async (client) => {
      const conv = await this.upsertKeyed(client, 'direct', key, userId)
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL`,
        [conv, userId, targetId]
      )
      return conv
    })
    return this.getConversation(userId, id)
  }

  // Hội thoại riêng với @puai (mỗi người 1 hội thoại)
  async openAi(userId: string): Promise<ConversationSummary> {
    const botId = await this.puai.getBotId()
    const id = await this.db.transaction(async (client) => {
      const conv = await this.upsertKeyed(client, 'ai', `ai:${userId}`, userId)
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')
         ON CONFLICT DO NOTHING`,
        [conv, userId, botId]
      )
      return conv
    })
    return this.getConversation(userId, id)
  }

  async createGroup(userId: string, input: CreateGroupChatInput): Promise<ConversationSummary> {
    this.groupLimiter.consume(userId)
    await this.assertCanStartChat(userId)
    const memberIds = Array.from(new Set(input.memberIds.filter((id) => id !== userId)))
    if (memberIds.length === 0) throw new BadRequestException('Chọn ít nhất 1 thành viên')
    if (memberIds.length + 1 > MAX_GROUP_MEMBERS) throw new BadRequestException(`Nhóm tối đa ${MAX_GROUP_MEMBERS} thành viên`)

    const id = await this.db.transaction(async (client) => {
      const valid = await client.query(
        `SELECT id FROM users WHERE id = ANY($1::uuid[]) AND account_type = 'human' AND status = 'active'`,
        [memberIds]
      )
      if (valid.rows.length === 0) throw new BadRequestException('Không có thành viên hợp lệ')
      const conv = await client.query(
        `INSERT INTO conversations (type, title, created_by) VALUES ('group', $1, $2) RETURNING id`,
        [input.title, userId]
      )
      const convId = conv.rows[0].id
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         SELECT $1, uid, CASE WHEN uid = $2 THEN 'owner' ELSE 'member' END
         FROM unnest($3::uuid[]) AS uid`,
        [convId, userId, [userId, ...valid.rows.map((r) => r.id)]]
      )
      return convId as string
    })
    const summary = await this.getConversation(userId, id)
    for (const m of summary.members) this.realtime.emitToUser(m.id, 'conv.updated', { conversationId: id })
    return summary
  }

  // Keyset pagination: before = id tin cũ nhất đã có
  async listMessages(userId: string, conversationId: string, before?: string, limit = 30): Promise<MessagesPage> {
    await this.assertMember(userId, conversationId)
    const lim = Math.min(50, Math.max(1, limit))
    const params: unknown[] = [conversationId, lim + 1]
    let where = `m.conversation_id = $1`
    if (before && /^\d+$/.test(before)) {
      params.push(before)
      where += ` AND m.id < $3`
    }
    const res = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages m LEFT JOIN users s ON s.id = m.sender_id
       WHERE ${where} ORDER BY m.id DESC LIMIT $2`,
      params
    )
    const rows = res.rows.slice(0, lim)
    return {
      data: rows.map(mapMessageRow),
      nextCursor: res.rows.length > lim ? String(rows[rows.length - 1].id) : null
    }
  }

  // ACID: lưu tin + cập nhật tin cuối của hội thoại + read cursor người gửi
  async sendMessage(userId: string, conversationId: string, input: SendMessageInput): Promise<ChatMessage> {
    this.sendLimiter.consume(userId)
    const { message, type, created } = await this.db.transaction(async (client) => {
      const member = await client.query(
        `SELECT c.type FROM conversation_members me JOIN conversations c ON c.id = me.conversation_id
         WHERE me.conversation_id = $1 AND me.user_id = $2 AND me.left_at IS NULL`,
        [conversationId, userId]
      )
      if (!member.rows[0]) throw new ForbiddenException('Bạn không ở trong hội thoại này')

      if (input.replyToId) {
        const reply = await client.query(`SELECT 1 FROM messages WHERE id = $1 AND conversation_id = $2`, [input.replyToId, conversationId])
        if (!reply.rows[0]) throw new BadRequestException('Tin nhắn được trả lời không tồn tại')
      }

      const ins = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, client_msg_id, content, reply_to_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (sender_id, client_msg_id) DO NOTHING
         RETURNING id`,
        [conversationId, userId, input.clientMsgId || null, input.content, input.replyToId || null]
      )
      // Gửi lại cùng clientMsgId ⇒ trả tin đã lưu, không tạo bản sao
      let messageId = ins.rows[0]?.id
      const isNew = !!messageId
      if (!messageId) {
        const existing = await client.query(`SELECT id FROM messages WHERE sender_id = $1 AND client_msg_id = $2`, [userId, input.clientMsgId])
        messageId = existing.rows[0].id
      } else {
        await this.touchConversation(client, conversationId, messageId)
        await client.query(
          `UPDATE conversation_members SET last_read_message_id = GREATEST(last_read_message_id, $3)
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, userId, messageId]
        )
      }
      return { message: await this.fetchMessage(client, messageId), type: member.rows[0].type as string, created: isNew }
    })

    if (created) {
      await this.broadcast(conversationId, 'message.new', message)
      // Hội thoại AI: @puai trả lời nền (không chặn phản hồi)
      if (type === 'ai') void this.puai.reply(conversationId, userId)
    }
    return message
  }

  async markRead(userId: string, conversationId: string, messageId: string): Promise<{ lastReadMessageId: string }> {
    const res = await this.db.query(
      `UPDATE conversation_members SET last_read_message_id = GREATEST(last_read_message_id, $3)
       WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL
       RETURNING last_read_message_id`,
      [conversationId, userId, messageId]
    )
    if (!res.rows[0]) throw new ForbiddenException('Bạn không ở trong hội thoại này')
    const lastRead = String(res.rows[0].last_read_message_id)
    // Đồng bộ trạng thái đã đọc giữa các tab/thiết bị của chính mình
    this.realtime.emitToUser(userId, 'conv.read', { conversationId, lastReadMessageId: lastRead })
    return { lastReadMessageId: lastRead }
  }

  // Thu hồi tin của chính mình (soft delete)
  async deleteMessage(userId: string, messageId: string): Promise<ChatMessage> {
    const res = await this.db.query(
      `UPDATE messages SET deleted_at = NOW() WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL RETURNING conversation_id`,
      [messageId, userId]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tin nhắn của bạn')
    const message = await this.fetchMessage(this.db, messageId)
    await this.broadcast(res.rows[0].conversation_id, 'message.updated', message)
    return message
  }

  async leaveGroup(userId: string, conversationId: string): Promise<{ left: boolean }> {
    const res = await this.db.query(
      `UPDATE conversation_members me SET left_at = NOW()
       FROM conversations c
       WHERE c.id = me.conversation_id AND c.type = 'group' AND me.conversation_id = $1 AND me.user_id = $2 AND me.left_at IS NULL
       RETURNING me.user_id`,
      [conversationId, userId]
    )
    if (!res.rows[0]) throw new BadRequestException('Chỉ rời được nhóm bạn đang tham gia')
    return { left: true }
  }

  // Thành viên đang hoạt động (dùng cho typing ở gateway)
  async isMember(userId: string, conversationId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [conversationId, userId]
    )
    return res.rows.length > 0
  }

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

  async fetchMessage(client: Queryable, messageId: string | number): Promise<ChatMessage> {
    const res = await client.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages m LEFT JOIN users s ON s.id = m.sender_id WHERE m.id = $1`,
      [messageId]
    )
    return mapMessageRow(res.rows[0])
  }

  async touchConversation(client: Queryable, conversationId: string, messageId: string | number) {
    await client.query(`UPDATE conversations SET last_message_id = $2, last_message_at = NOW() WHERE id = $1`, [conversationId, messageId])
  }

  private async assertMember(userId: string, conversationId: string) {
    if (!(await this.isMember(userId, conversationId))) throw new ForbiddenException('Bạn không ở trong hội thoại này')
  }

  // Chống spam: chỉ tài khoản đã xác thực email mới bắt đầu hội thoại mới
  private async assertCanStartChat(userId: string) {
    const res = await this.db.query(`SELECT email_verified FROM users WHERE id = $1`, [userId])
    if (!res.rows[0]?.email_verified) throw new ForbiddenException('Xác thực email để bắt đầu nhắn tin')
  }

  private async upsertKeyed(client: PoolClient, type: 'direct' | 'ai', key: string, createdBy: string): Promise<string> {
    const ins = await client.query(
      `INSERT INTO conversations (type, direct_key, created_by) VALUES ($1, $2, $3)
       ON CONFLICT (direct_key) DO NOTHING RETURNING id`,
      [type, key, createdBy]
    )
    if (ins.rows[0]) return ins.rows[0].id
    const found = await client.query(`SELECT id FROM conversations WHERE direct_key = $1`, [key])
    return found.rows[0].id
  }

  private summarySelect() {
    return `
      SELECT c.id, c.type, c.title, c.avatar_url, c.last_message_at, c.created_at, me.last_read_message_id,
             (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id = c.id AND x.left_at IS NULL)::int AS member_count,
             (SELECT COUNT(*) FROM messages um
              WHERE um.conversation_id = c.id AND um.id > me.last_read_message_id
                AND um.deleted_at IS NULL AND um.sender_id IS DISTINCT FROM me.user_id)::int AS unread_count,
             COALESCE((SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'displayName', u.display_name,
                                                          'avatarUrl', u.avatar_url, 'isBot', u.account_type = 'bot'))
                       FROM (SELECT u.* FROM conversation_members o JOIN users u ON u.id = o.user_id
                             WHERE o.conversation_id = c.id AND o.user_id <> me.user_id AND o.left_at IS NULL
                             ORDER BY o.joined_at LIMIT 8) u), '[]'::json) AS members,
             lm.row AS last_message
      FROM conversation_members me
      JOIN conversations c ON c.id = me.conversation_id
      LEFT JOIN LATERAL (
        SELECT row_to_json(t) AS row FROM (
          SELECT ${MESSAGE_COLUMNS} FROM messages m LEFT JOIN users s ON s.id = m.sender_id
          WHERE m.id = c.last_message_id
        ) t
      ) lm ON TRUE`
  }

  private mapSummary(row: any): ConversationSummary {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      avatarUrl: row.avatar_url,
      members: (row.members || []) as ChatUser[],
      memberCount: row.member_count,
      lastMessage: row.last_message ? mapMessageRow(row.last_message) : null,
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
      unreadCount: row.unread_count,
      lastReadMessageId: String(row.last_read_message_id)
    }
  }
}
