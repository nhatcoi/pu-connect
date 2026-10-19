import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  AiThread,
  ChatAttachment,
  ChatMessage,
  ChatMessageMeta,
  ChatReactionDetail,
  ChatSharedPost,
  EditMessageInput,
  MessagesPage,
  SendMessageInput
} from '@pu/schemas'
import { SimpleRateLimiter } from '../../auth/rate-limit.util'
import { StorageService } from '../../storage/storage.service'
import { ChatCoreService } from '../chat-core.service'
import { MESSAGE_COLUMNS, MESSAGE_FROM, mapMessageRow } from '../chat.mapper'
import { ChatMentionsService, mentionMeta } from '../mentions/chat-mentions.service'
import { ChatPushService } from '../notify/chat-push.service'
import { AiSkillsService } from '../n7ai/ai-skills.service'
import { deriveThreadTitle, mapThread } from '../n7ai/ai-threads.service'
import { N7AiService, type ReplyOutcome } from '../n7ai/n7ai.service'
import { ChatRefsService } from '../refs/chat-refs.service'
import { N7AI_MENTION } from '../../ai/ai.constants'

type Membership = { type: string; role: string }

const EDIT_WINDOW_MS = 15 * 60 * 1000 // sửa tin trong 15 phút

// Tin nhắn: gửi/sửa/thu hồi, cảm xúc, ghim, tìm kiếm, kho tệp
@Injectable()
export class MessagesService {
  // 20 tin / 10 giây / user; cảm xúc 60 / phút
  private readonly sendLimiter = new SimpleRateLimiter(20, 10_000)
  private readonly reactLimiter = new SimpleRateLimiter(60, 60_000)

  constructor(
    private readonly core: ChatCoreService,
    private readonly n7ai: N7AiService,
    private readonly storage: StorageService,
    private readonly chatPush: ChatPushService,
    private readonly mentions: ChatMentionsService,
    private readonly refs: ChatRefsService,
    private readonly skills: AiSkillsService
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

  // Gửi tin của người dùng (giới hạn tốc độ) rồi để N7AI trả lời nền khi được hỏi
  async send(userId: string, conversationId: string, input: SendMessageInput): Promise<ChatMessage> {
    this.sendLimiter.consume(userId)
    const { message, asksAi } = await this.persist(userId, conversationId, input)
    if (asksAi) void this.n7ai.reply(conversationId, userId, message.id)
    return message
  }

  // Chia sẻ bài viết: tin của người dùng kèm thẻ xem trước (meta.sharedPost); không gọi N7AI
  // Shared post message; never triggers an AI reply
  async sendShared(userId: string, conversationId: string, input: SendMessageInput, sharedPost: ChatSharedPost): Promise<ChatMessage> {
    this.sendLimiter.consume(userId)
    const { message } = await this.persist(userId, conversationId, input, { sharedPost })
    return message
  }

  // Tác vụ tự động: đăng câu hỏi thay người dùng (gắn meta.task) rồi chờ N7AI trả lời xong
  async sendAsTask(userId: string, conversationId: string, input: SendMessageInput, task: { id: string; title: string }): Promise<ReplyOutcome> {
    const { message } = await this.persist(userId, conversationId, input, { task })
    return this.n7ai.reply(conversationId, userId, message.id)
  }

  // ACID: lưu tin + cập nhật tin cuối + read cursor người gửi + mention / ngữ cảnh / skill / tiêu đề thread AI; phát sự kiện sau commit
  private async persist(
    userId: string,
    conversationId: string,
    input: SendMessageInput,
    extraMeta: ChatMessageMeta = {}
  ): Promise<{ message: ChatMessage; asksAi: boolean }> {
    const attachments = this.checkAttachments(userId, input.attachments)
    const { message, type, created, mentioned, thread } = await this.db.transaction(async (client) => {
      const member = await this.core.membership(client, userId, conversationId)
      if (!member) throw new ForbiddenException('Bạn không ở trong hội thoại này')
      if (member.type === 'direct') await this.core.assertDirectNotBlocked(client, userId, conversationId)

      if (input.replyToId) {
        const reply = await client.query(`SELECT 1 FROM messages WHERE id = $1 AND conversation_id = $2`, [input.replyToId, conversationId])
        if (!reply.rows[0]) throw new BadRequestException('Tin nhắn được trả lời không tồn tại')
      }
      const meta = { ...this.aiMeta(member.type, input), ...extraMeta }

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
          Object.keys(meta).length ? JSON.stringify(meta) : null
        ]
      )
      // Gửi lại cùng clientMsgId ⇒ trả tin đã lưu, không tạo bản sao
      let messageId = ins.rows[0]?.id
      if (!messageId) {
        const existing = await client.query(`SELECT id FROM messages WHERE sender_id = $1 AND client_msg_id = $2`, [userId, input.clientMsgId])
        messageId = existing.rows[0].id
        return { message: await this.core.fetchMessage(client, messageId), type: member.type, created: false, mentioned: [], thread: null }
      }

      await this.core.touchConversation(client, conversationId, messageId)
      await client.query(
        `UPDATE conversation_members SET last_read_message_id = GREATEST(last_read_message_id, $3)
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId, messageId]
      )
      const mentioned = await this.attachEntities(client, userId, conversationId, String(messageId), member, input)
      const thread = member.type === 'ai' ? await this.autoTitle(client, conversationId, input.content) : null
      return { message: await this.core.fetchMessage(client, messageId), type: member.type, created: true, mentioned, thread }
    })

    if (!created) return { message, asksAi: false }
    await this.core.broadcast(conversationId, 'message.new', message)
    if (thread) this.core.emitTo([userId], 'ai.thread.updated', thread)
    void this.chatPush.onNewMessage(conversationId, userId, mentioned) // Web Push (trễ, gộp tin; bị nhắc ⇒ vượt tắt tiếng)
    return { message, asksAi: this.asksAi(type, input.content, message.meta) }
  }

  // Chế độ học / Research / connector chỉ có nghĩa khi hỏi N7AI (thread AI hoặc nhóm)
  private aiMeta(type: string, input: SendMessageInput): ChatMessageMeta {
    if (type === 'direct') return {}
    const meta: ChatMessageMeta = {}
    if (input.aiMode && input.aiMode !== 'ask') meta.aiMode = input.aiMode
    if (input.research) meta.research = true
    if (type === 'ai' && input.connectors?.length) meta.connectors = [...new Set(input.connectors)]
    return meta
  }

  // Sau khi có id tin: mention (nhóm), ngữ cảnh, skill ⇒ gộp vào meta bằng 1 câu UPDATE; trả người nhận mention
  private async attachEntities(
    client: PoolClient,
    userId: string,
    conversationId: string,
    messageId: string,
    member: Membership,
    input: SendMessageInput
  ): Promise<string[]> {
    const extra: ChatMessageMeta = {}
    const refs = await this.refs.resolve(client, userId, input.refs, member.type === 'ai')
    if (refs.length) extra.refs = refs
    if (member.type !== 'direct') {
      const skill = await this.skills.useForMessage(client, userId, input.skillId)
      if (skill) extra.skill = skill
    }
    let recipients: string[] = []
    if (member.type === 'group') {
      const result = await this.mentions.sync(client, { conversationId, messageId, authorId: userId, isOwner: member.role === 'owner', content: input.content })
      Object.assign(extra, mentionMeta(result))
      recipients = result.recipientIds
    }
    if (Object.keys(extra).length) {
      await client.query(`UPDATE messages SET meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb WHERE id = $1`, [messageId, JSON.stringify(extra)])
    }
    return recipients
  }

  // Thread AI chưa có tiêu đề ⇒ lấy từ câu hỏi đầu (tin chỉ có tệp ⇒ để tin sau)
  private async autoTitle(client: PoolClient, conversationId: string, content: string): Promise<AiThread | null> {
    const title = deriveThreadTitle(content)
    if (!title) return null
    const res = await client.query(`UPDATE conversations SET title = $2 WHERE id = $1 AND title IS NULL RETURNING id, title, last_message_at, created_at`, [
      conversationId,
      title
    ])
    return res.rows[0] ? mapThread(res.rows[0]) : null
  }

  // Thread AI luôn hỏi; nhóm: @n7ai, hoặc chọn chế độ / skill / Research qua "/" hay "+"
  private asksAi(type: string, content: string, meta: ChatMessageMeta | null): boolean {
    if (type === 'ai') return true
    return type === 'group' && (N7AI_MENTION.test(content) || !!meta?.aiMode || !!meta?.skill || !!meta?.research)
  }

  // Sửa tin văn bản của mình trong 15 phút; nhóm ⇒ tính lại mention (bỏ @ thì hết badge, không push lại)
  async edit(userId: string, messageId: string, input: EditMessageInput): Promise<ChatMessage> {
    const conversationId = await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE messages SET content = $3, edited_at = NOW()
         WHERE id = $1 AND sender_id = $2 AND kind = 'text' AND deleted_at IS NULL AND created_at > NOW() - make_interval(secs => $4)
         RETURNING conversation_id`,
        [messageId, userId, input.content, EDIT_WINDOW_MS / 1000]
      )
      if (!res.rows[0]) throw new BadRequestException('Chỉ sửa được tin của bạn trong 15 phút sau khi gửi')
      const convId: string = res.rows[0].conversation_id
      const member = await this.core.membership(client, userId, convId)
      if (member?.type === 'group') {
        const result = await this.mentions.sync(client, {
          conversationId: convId,
          messageId,
          authorId: userId,
          isOwner: member.role === 'owner',
          content: input.content,
          replace: true
        })
        await client.query(
          `UPDATE messages SET meta = NULLIF((COALESCE(meta, '{}'::jsonb) - 'mentions' - 'mentionAll') || $2::jsonb, '{}'::jsonb) WHERE id = $1`,
          [messageId, JSON.stringify(mentionMeta(result))]
        )
      }
      return convId
    })
    return this.publishUpdate(conversationId, messageId)
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
        await client.query(`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [messageId, userId, emoji])
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
