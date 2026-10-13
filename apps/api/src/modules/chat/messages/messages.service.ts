import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { ChatAttachment, ChatMessage, ChatReactionDetail, EditMessageInput, MessagesPage, SendMessageInput } from '@pu/schemas'
import { SimpleRateLimiter } from '../../auth/rate-limit.util'
import { StorageService } from '../../storage/storage.service'
import { ChatCoreService } from '../chat-core.service'
import { MESSAGE_COLUMNS, MESSAGE_FROM, mapMessageRow } from '../chat.mapper'
import { ChatPushService } from '../notify/chat-push.service'
import { PuaiService } from '../puai/puai.service'
import { PUAI_MENTION } from '../../ai/ai.constants'

const EDIT_WINDOW_MS = 15 * 60 * 1000 // sửa tin trong 15 phút

// Tin nhắn: gửi/sửa/thu hồi, cảm xúc, ghim, tìm kiếm, kho tệp
@Injectable()
export class MessagesService {
  // 20 tin / 10 giây / user; cảm xúc 60 / phút
  private readonly sendLimiter = new SimpleRateLimiter(20, 10_000)
  private readonly reactLimiter = new SimpleRateLimiter(60, 60_000)

  constructor(
    private readonly core: ChatCoreService,
    private readonly puai: PuaiService,
    private readonly storage: StorageService,
    private readonly chatPush: ChatPushService
  ) {}

  private get db() {
    return this.core.db
  }

  // Keyset pagination: before = id tin cũ nhất đã có
  async list(userId: string, conversationId: string, before?: string, limit = 30): Promise<MessagesPage> {
    await this.core.assertMember(userId, conversationId)
    const lim = Math.min(50, Math.max(1, limit))
    const params: unknown[] = [conversationId, lim + 1]
    let where = `m.conversation_id = $1`
    if (before && /^\d+$/.test(before)) {
      params.push(before)
      where += ` AND m.id < $3`
    }
    const res = await this.db.query(`SELECT ${MESSAGE_COLUMNS} ${MESSAGE_FROM} WHERE ${where} ORDER BY m.id DESC LIMIT $2`, params)
    const rows = res.rows.slice(0, lim)
    return { data: rows.map(mapMessageRow), nextCursor: res.rows.length > lim ? String(rows[rows.length - 1].id) : null }
  }

  // ACID: lưu tin + cập nhật tin cuối của hội thoại + read cursor người gửi
  async send(userId: string, conversationId: string, input: SendMessageInput): Promise<ChatMessage> {
    this.sendLimiter.consume(userId)
    const attachments = this.checkAttachments(userId, input.attachments)
    const { message, type, created } = await this.db.transaction(async (client) => {
      const member = await this.core.membership(client, userId, conversationId)
      if (!member) throw new ForbiddenException('Bạn không ở trong hội thoại này')
      if (member.type === 'direct') await this.core.assertDirectNotBlocked(client, userId, conversationId)

      if (input.replyToId) {
        const reply = await client.query(`SELECT 1 FROM messages WHERE id = $1 AND conversation_id = $2`, [input.replyToId, conversationId])
        if (!reply.rows[0]) throw new BadRequestException('Tin nhắn được trả lời không tồn tại')
      }
      // Chế độ học chỉ có nghĩa khi hỏi PU AI
      const meta = input.aiMode && input.aiMode !== 'ask' && member.type !== 'direct' ? { aiMode: input.aiMode } : null

      const ins = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, client_msg_id, content, reply_to_id, attachments, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (sender_id, client_msg_id) DO NOTHING
         RETURNING id`,
        [
          conversationId,
          userId,
          input.clientMsgId || null,
          input.content,
          input.replyToId || null,
          attachments ? JSON.stringify(attachments) : null,
          meta ? JSON.stringify(meta) : null
        ]
      )
      // Gửi lại cùng clientMsgId ⇒ trả tin đã lưu, không tạo bản sao
      let messageId = ins.rows[0]?.id
      const isNew = !!messageId
      if (!messageId) {
        const existing = await client.query(`SELECT id FROM messages WHERE sender_id = $1 AND client_msg_id = $2`, [userId, input.clientMsgId])
        messageId = existing.rows[0].id
      } else {
        await this.core.touchConversation(client, conversationId, messageId)
        await client.query(
          `UPDATE conversation_members SET last_read_message_id = GREATEST(last_read_message_id, $3)
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, userId, messageId]
        )
      }
      return { message: await this.core.fetchMessage(client, messageId), type: member.type, created: isNew }
    })

    if (created) {
      await this.core.broadcast(conversationId, 'message.new', message)
      void this.chatPush.onNewMessage(conversationId, userId) // Web Push (trễ, gộp tin)
      // PU AI trả lời nền: hội thoại AI, hoặc được @puai trong nhóm
      if (type === 'ai') void this.puai.reply(conversationId, userId, message.id)
      else if (type === 'group' && PUAI_MENTION.test(input.content)) void this.puai.reply(conversationId, userId, message.id)
    }
    return message
  }

  // Sửa tin văn bản của mình trong 15 phút
  async edit(userId: string, messageId: string, input: EditMessageInput): Promise<ChatMessage> {
    const res = await this.db.query(
      `UPDATE messages SET content = $3, edited_at = NOW()
       WHERE id = $1 AND sender_id = $2 AND kind = 'text' AND deleted_at IS NULL AND created_at > NOW() - make_interval(secs => $4)
       RETURNING conversation_id`,
      [messageId, userId, input.content, EDIT_WINDOW_MS / 1000]
    )
    if (!res.rows[0]) throw new BadRequestException('Chỉ sửa được tin của bạn trong 15 phút sau khi gửi')
    return this.publishUpdate(res.rows[0].conversation_id, messageId)
  }

  // Thu hồi tin của chính mình (soft delete, bỏ ghim)
  async remove(userId: string, messageId: string): Promise<ChatMessage> {
    const res = await this.db.query(
      `UPDATE messages SET deleted_at = NOW(), pinned_at = NULL
       WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL RETURNING conversation_id`,
      [messageId, userId]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tin nhắn của bạn')
    return this.publishUpdate(res.rows[0].conversation_id, messageId)
  }

  // Bật/tắt 1 cảm xúc của mình trên tin
  async react(userId: string, messageId: string, emoji: string): Promise<ChatMessage> {
    this.reactLimiter.consume(userId)
    const conversationId = await this.messageConversation(userId, messageId)
    await this.db.transaction(async (client) => {
      const del = await client.query(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING 1`, [
        messageId,
        userId,
        emoji
      ])
      if (!del.rows[0]) {
        await client.query(`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
          messageId,
          userId,
          emoji
        ])
      }
    })
    return this.publishUpdate(conversationId, messageId)
  }

  // Ai đã thả cảm xúc nào (kể cả người đã rời nhóm) / Who reacted
  async listReactions(userId: string, messageId: string): Promise<ChatReactionDetail[]> {
    await this.messageConversation(userId, messageId)
    const res = await this.db.query(
      `SELECT r.emoji, r.created_at, u.id, u.username, u.display_name, u.avatar_url, u.account_type
       FROM message_reactions r JOIN users u ON u.id = r.user_id
       WHERE r.message_id = $1 ORDER BY r.created_at DESC LIMIT 500`,
      [messageId]
    )
    return res.rows.map((r) => ({
      emoji: r.emoji,
      createdAt: new Date(r.created_at).toISOString(),
      user: { id: r.id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, isBot: r.account_type === 'bot' }
    }))
  }

  // Ghim / bỏ ghim (mọi thành viên)
  async togglePin(userId: string, messageId: string): Promise<ChatMessage> {
    const conversationId = await this.messageConversation(userId, messageId)
    const res = await this.db.query(
      `UPDATE messages SET pinned_at = CASE WHEN pinned_at IS NULL THEN NOW() END,
                           pinned_by = CASE WHEN pinned_at IS NULL THEN $2::uuid END
       WHERE id = $1 AND deleted_at IS NULL AND kind <> 'system' RETURNING id`,
      [messageId, userId]
    )
    if (!res.rows[0]) throw new BadRequestException('Không ghim được tin này')
    return this.publishUpdate(conversationId, messageId)
  }

  async listPinned(userId: string, conversationId: string): Promise<ChatMessage[]> {
    await this.core.assertMember(userId, conversationId)
    const res = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} ${MESSAGE_FROM}
       WHERE m.conversation_id = $1 AND m.pinned_at IS NOT NULL AND m.deleted_at IS NULL
       ORDER BY m.pinned_at DESC LIMIT 50`,
      [conversationId]
    )
    return res.rows.map(mapMessageRow)
  }

  // Kho "Ảnh & tệp" của hội thoại
  async listAttachments(userId: string, conversationId: string, kind?: string): Promise<ChatMessage[]> {
    await this.core.assertMember(userId, conversationId)
    const filter = kind === 'image' || kind === 'file' ? `AND m.attachments @> $2::jsonb` : ''
    const params: unknown[] = [conversationId]
    if (filter) params.push(JSON.stringify([{ kind }]))
    const res = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} ${MESSAGE_FROM}
       WHERE m.conversation_id = $1 AND m.attachments IS NOT NULL AND m.deleted_at IS NULL ${filter}
       ORDER BY m.id DESC LIMIT 60`,
      params
    )
    return res.rows.map(mapMessageRow)
  }

  // Tìm tin trong hội thoại (không dấu, ILIKE)
  async search(userId: string, conversationId: string, q: string): Promise<ChatMessage[]> {
    await this.core.assertMember(userId, conversationId)
    const term = q.trim()
    if (term.length < 2) return []
    const res = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} ${MESSAGE_FROM}
       WHERE m.conversation_id = $1 AND m.deleted_at IS NULL AND m.kind <> 'system'
         AND immutable_unaccent(m.content) ILIKE '%' || immutable_unaccent($2) || '%'
       ORDER BY m.id DESC LIMIT 30`,
      [conversationId, term.slice(0, 100).replace(/[%_\\]/g, (c) => `\\${c}`)]
    )
    return res.rows.map(mapMessageRow)
  }

  // Tệp phải do chính người gửi tải lên thư mục chat/ của R2
  private checkAttachments(userId: string, list?: ChatAttachment[]): ChatAttachment[] | null {
    if (!list?.length) return null
    for (const a of list) {
      if (!this.storage.isOwnedKey(a.key, 'chat', userId) || a.url !== this.storage.publicUrlFor(a.key)) {
        throw new BadRequestException('Tệp đính kèm không hợp lệ')
      }
    }
    return list.map((a) => ({ ...a, kind: a.mime.startsWith('image/') ? 'image' : 'file' }))
  }

  private async messageConversation(userId: string, messageId: string): Promise<string> {
    const res = await this.db.query(
      `SELECT m.conversation_id FROM messages m
       JOIN conversation_members me ON me.conversation_id = m.conversation_id AND me.user_id = $2 AND me.left_at IS NULL
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [messageId, userId]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tin nhắn')
    return res.rows[0].conversation_id
  }

  private async publishUpdate(conversationId: string, messageId: string): Promise<ChatMessage> {
    const message = await this.core.fetchMessage(this.db, messageId)
    await this.core.broadcast(conversationId, 'message.updated', message)
    return message
  }
}
