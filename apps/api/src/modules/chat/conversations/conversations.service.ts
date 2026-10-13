import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  ChatMember,
  ConversationSummary,
  CreateGroupChatInput,
  MemberSettingsInput,
  UpdateGroupInput
} from '@pu/schemas'
import { SimpleRateLimiter } from '../../auth/rate-limit.util'
import { StorageService } from '../../storage/storage.service'
import { ChatCoreService } from '../chat-core.service'
import { SUMMARY_SELECT, mapMemberRow, mapSummaryRow } from '../chat.mapper'
import { PuaiService } from '../puai/puai.service'

const MAX_GROUP_MEMBERS = 50

// Hội thoại: DM, nhóm, PU AI; quản lý thành viên & cài đặt riêng
@Injectable()
export class ConversationsService {
  private readonly groupLimiter = new SimpleRateLimiter(10, 86_400_000) // tạo nhóm 10 / ngày

  constructor(
    private readonly core: ChatCoreService,
    private readonly puai: PuaiService,
    private readonly storage: StorageService
  ) {}

  private get db() {
    return this.core.db
  }

  // PU AI ghim đầu, rồi hội thoại tự ghim, còn lại theo tin mới nhất
  async list(userId: string): Promise<ConversationSummary[]> {
    const res = await this.db.query(
      `${SUMMARY_SELECT}
       WHERE me.user_id = $1 AND me.left_at IS NULL
       ORDER BY (c.type = 'ai') DESC, me.pinned_at DESC NULLS LAST, COALESCE(c.last_message_at, c.created_at) DESC
       LIMIT 100`,
      [userId]
    )
    return res.rows.map(mapSummaryRow)
  }

  async get(userId: string, conversationId: string): Promise<ConversationSummary> {
    const res = await this.db.query(`${SUMMARY_SELECT} WHERE me.user_id = $1 AND me.left_at IS NULL AND c.id = $2`, [userId, conversationId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy hội thoại')
    return mapSummaryRow(res.rows[0])
  }

  // Tổng tin chưa đọc (badge "Tin nhắn"); bỏ qua hội thoại đang tắt thông báo
  async unreadTotal(userId: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COALESCE(SUM(LEAST(x.n, 99)), 0)::int AS total FROM (
         SELECT (SELECT COUNT(*) FROM messages m
                 WHERE m.conversation_id = me.conversation_id AND m.id > me.last_read_message_id
                   AND m.deleted_at IS NULL AND m.kind <> 'system' AND m.sender_id IS DISTINCT FROM $1) AS n
         FROM conversation_members me
         WHERE me.user_id = $1 AND me.left_at IS NULL AND (me.muted_until IS NULL OR me.muted_until < NOW())
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
    if (t.account_type !== 'human' || t.status === 'suspended') throw new ForbiddenException('Không thể nhắn tin cho tài khoản này')
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
    return this.get(userId, id)
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
    return this.get(userId, id)
  }

  async createGroup(userId: string, input: CreateGroupChatInput): Promise<ConversationSummary> {
    this.groupLimiter.consume(userId)
    await this.assertCanStartChat(userId)
    const memberIds = Array.from(new Set(input.memberIds.filter((id) => id !== userId)))
    if (memberIds.length === 0) throw new BadRequestException('Chọn ít nhất 1 thành viên')
    if (memberIds.length + 1 > MAX_GROUP_MEMBERS) throw new BadRequestException(`Nhóm tối đa ${MAX_GROUP_MEMBERS} thành viên`)

    const { id, system } = await this.db.transaction(async (client) => {
      const valid = await this.validUsers(client, memberIds)
      if (valid.length === 0) throw new BadRequestException('Không có thành viên hợp lệ')
      const conv = await client.query(`INSERT INTO conversations (type, title, created_by) VALUES ('group', $1, $2) RETURNING id`, [
        input.title,
        userId
      ])
      const convId = conv.rows[0].id as string
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         SELECT $1, uid, CASE WHEN uid = $2 THEN 'owner' ELSE 'member' END FROM unnest($3::uuid[]) AS uid`,
        [convId, userId, [userId, ...valid]]
      )
      const [actor] = await this.core.displayNames(client, [userId])
      const msg = await this.core.insertSystem(client, convId, userId, `${actor} đã tạo nhóm "${input.title}"`, {
        event: 'group.created',
        actorName: actor
      })
      return { id: convId, system: msg }
    })
    await this.core.broadcast(id, 'message.new', system)
    return this.get(userId, id)
  }

  // Đổi tên / ảnh nhóm (mọi thành viên); mỗi thay đổi ghi 1 tin hệ thống
  async updateGroup(userId: string, conversationId: string, input: UpdateGroupInput): Promise<ConversationSummary> {
    const avatarUrl = input.avatarKey === undefined ? undefined : this.groupAvatarUrl(userId, input.avatarKey)
    const systems = await this.db.transaction(async (client) => {
      await this.assertGroupMember(client, userId, conversationId)
      const changes: [string, unknown][] = []
      if (input.title !== undefined) changes.push(['title', input.title])
      if (avatarUrl !== undefined) changes.push(['avatar_url', avatarUrl])
      if (!changes.length) return []
      await client.query(
        `UPDATE conversations SET ${changes.map(([col], i) => `${col} = $${i + 2}`).join(', ')} WHERE id = $1`,
        [conversationId, ...changes.map(([, v]) => v)]
      )

      const [actor] = await this.core.displayNames(client, [userId])
      const out = []
      if (input.title !== undefined) {
        out.push(await this.core.insertSystem(client, conversationId, userId, `${actor} đã đổi tên nhóm thành "${input.title}"`, { event: 'group.renamed', actorName: actor }))
      }
      if (avatarUrl !== undefined) {
        const text = avatarUrl ? `${actor} đã đổi ảnh nhóm` : `${actor} đã xóa ảnh nhóm`
        out.push(await this.core.insertSystem(client, conversationId, userId, text, { event: 'group.avatar', actorName: actor }))
      }
      return out
    })
    for (const m of systems) await this.core.broadcast(conversationId, 'message.new', m)
    if (systems.length) await this.core.broadcast(conversationId, 'conv.updated', { conversationId })
    return this.get(userId, conversationId)
  }

  // Ảnh nhóm chỉ nhận ảnh do chính người đổi tải lên avatars/{userId}/ (thư mục chỉ cho phép ảnh)
  private groupAvatarUrl(userId: string, key: string | null): string | null {
    if (key === null) return null
    if (!this.storage.isOwnedKey(key, 'avatars', userId)) throw new BadRequestException('Ảnh nhóm không hợp lệ')
    return this.storage.publicUrlFor(key)
  }

  async listMembers(userId: string, conversationId: string): Promise<ChatMember[]> {
    await this.core.assertMember(userId, conversationId)
    const res = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.account_type, me.role, me.last_read_message_id, me.joined_at
       FROM conversation_members me JOIN users u ON u.id = me.user_id
       WHERE me.conversation_id = $1 AND me.left_at IS NULL
       ORDER BY (me.role = 'owner') DESC, me.joined_at`,
      [conversationId]
    )
    return res.rows.map(mapMemberRow)
  }

  // Thêm thành viên: thành viên nào cũng thêm được, giới hạn 50 người
  async addMembers(userId: string, conversationId: string, userIds: string[]): Promise<ChatMember[]> {
    const system = await this.db.transaction(async (client) => {
      await this.assertGroupMember(client, userId, conversationId)
      const valid = await this.validUsers(
        client,
        userIds.filter((id) => id !== userId)
      )
      const current = await client.query(
        `SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND left_at IS NULL`,
        [conversationId]
      )
      const existing = new Set(current.rows.map((r) => r.user_id))
      const added = valid.filter((id) => !existing.has(id))
      if (!added.length) throw new BadRequestException('Những người này đã ở trong nhóm')
      if (existing.size + added.length > MAX_GROUP_MEMBERS) throw new BadRequestException(`Nhóm tối đa ${MAX_GROUP_MEMBERS} thành viên`)
      // Người từng rời nhóm ⇒ vào lại (rejoin)
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         SELECT $1, uid, 'member' FROM unnest($2::uuid[]) AS uid
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL, role = 'member', joined_at = NOW()`,
        [conversationId, added]
      )
      const [actor] = await this.core.displayNames(client, [userId])
      const names = await this.core.displayNames(client, added)
      return this.core.insertSystem(client, conversationId, userId, `${actor} đã thêm ${names.join(', ')} vào nhóm`, {
        event: 'member.added',
        actorName: actor,
        targetNames: names
      })
    })
    await this.core.broadcast(conversationId, 'message.new', system)
    await this.core.broadcast(conversationId, 'conv.updated', { conversationId })
    return this.listMembers(userId, conversationId)
  }

  // Xóa thành viên: chỉ trưởng nhóm
  async removeMember(userId: string, conversationId: string, targetId: string): Promise<{ removed: boolean }> {
    if (userId === targetId) throw new BadRequestException('Dùng "Rời nhóm" để tự rời')
    const system = await this.db.transaction(async (client) => {
      const m = await this.assertGroupMember(client, userId, conversationId)
      if (m.role !== 'owner') throw new ForbiddenException('Chỉ trưởng nhóm được xóa thành viên')
      const res = await client.query(
        `UPDATE conversation_members SET left_at = NOW() WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL RETURNING user_id`,
        [conversationId, targetId]
      )
      if (!res.rows[0]) throw new NotFoundException('Thành viên không có trong nhóm')
      const [actor, target] = await this.core.displayNames(client, [userId, targetId])
      return this.core.insertSystem(client, conversationId, userId, `${actor} đã xóa ${target} khỏi nhóm`, {
        event: 'member.removed',
        actorName: actor,
        targetNames: [target]
      })
    })
    await this.core.broadcast(conversationId, 'message.new', system)
    await this.core.broadcast(conversationId, 'conv.updated', { conversationId })
    this.core.emitTo([targetId], 'conv.removed', { conversationId })
    return { removed: true }
  }

  // Chuyển quyền trưởng nhóm (Transfer ownership): khóa hàng hội thoại ⇒ không có 2 lượt chuyển song song
  async transferOwnership(userId: string, conversationId: string, targetId: string): Promise<ChatMember[]> {
    if (userId === targetId) throw new BadRequestException('Bạn đang là trưởng nhóm')
    const system = await this.db.transaction(async (client) => {
      await client.query(`SELECT 1 FROM conversations WHERE id = $1 FOR UPDATE`, [conversationId])
      const m = await this.assertGroupMember(client, userId, conversationId)
      if (m.role !== 'owner') throw new ForbiddenException('Chỉ trưởng nhóm được chuyển quyền')
      const res = await client.query(
        `UPDATE conversation_members me SET role = 'owner' FROM users u
         WHERE u.id = me.user_id AND u.account_type = 'human'
           AND me.conversation_id = $1 AND me.user_id = $2 AND me.left_at IS NULL
         RETURNING me.user_id`,
        [conversationId, targetId]
      )
      if (!res.rows[0]) throw new NotFoundException('Thành viên không có trong nhóm')
      await client.query(`UPDATE conversation_members SET role = 'member' WHERE conversation_id = $1 AND user_id = $2`, [conversationId, userId])
      const [actor, target] = await this.core.displayNames(client, [userId, targetId])
      return this.core.insertSystem(client, conversationId, userId, `${actor} đã chuyển quyền trưởng nhóm cho ${target}`, {
        event: 'owner.transferred',
        actorName: actor,
        targetNames: [target]
      })
    })
    await this.core.broadcast(conversationId, 'message.new', system)
    await this.core.broadcast(conversationId, 'conv.updated', { conversationId })
    return this.listMembers(userId, conversationId)
  }

  // Rời nhóm; trưởng nhóm rời ⇒ chuyển quyền cho người vào sớm nhất
  async leave(userId: string, conversationId: string): Promise<{ left: boolean }> {
    const system = await this.db.transaction(async (client) => {
      const m = await this.assertGroupMember(client, userId, conversationId)
      await client.query(`UPDATE conversation_members SET left_at = NOW(), pinned_at = NULL WHERE conversation_id = $1 AND user_id = $2`, [
        conversationId,
        userId
      ])
      if (m.role === 'owner') {
        await client.query(
          `UPDATE conversation_members SET role = 'owner'
           WHERE (conversation_id, user_id) = (
             SELECT me.conversation_id, me.user_id FROM conversation_members me JOIN users u ON u.id = me.user_id
             WHERE me.conversation_id = $1 AND me.left_at IS NULL AND u.account_type = 'human' ORDER BY me.joined_at LIMIT 1)`,
          [conversationId]
        )
      }
      const [actor] = await this.core.displayNames(client, [userId])
      return this.core.insertSystem(client, conversationId, userId, `${actor} đã rời nhóm`, { event: 'member.left', actorName: actor })
    })
    await this.core.broadcast(conversationId, 'message.new', system)
    await this.core.broadcast(conversationId, 'conv.updated', { conversationId })
    return { left: true }
  }

  // Cài đặt riêng: tắt thông báo, ghim hội thoại
  async updateSettings(userId: string, conversationId: string, input: MemberSettingsInput): Promise<ConversationSummary> {
    const sets: string[] = []
    if (input.mutedHours !== undefined) {
      sets.push(
        input.mutedHours === 0
          ? `muted_until = NULL`
          : input.mutedHours < 0
            ? `muted_until = 'infinity'`
            : `muted_until = NOW() + make_interval(hours => ${input.mutedHours})`
      )
    }
    if (input.pinned !== undefined) sets.push(input.pinned ? `pinned_at = NOW()` : `pinned_at = NULL`)
    if (sets.length) {
      const res = await this.db.query(
        `UPDATE conversation_members SET ${sets.join(', ')} WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL RETURNING 1`,
        [conversationId, userId]
      )
      if (!res.rows[0]) throw new ForbiddenException('Bạn không ở trong hội thoại này')
    }
    return this.get(userId, conversationId)
  }

  // Con trỏ đã đọc: báo cho mọi thành viên (hiện "Đã xem") & các tab của mình
  async markRead(userId: string, conversationId: string, messageId: string): Promise<{ lastReadMessageId: string }> {
    const res = await this.db.query(
      `UPDATE conversation_members SET last_read_message_id = GREATEST(last_read_message_id, $3)
       WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL
       RETURNING last_read_message_id`,
      [conversationId, userId, messageId]
    )
    if (!res.rows[0]) throw new ForbiddenException('Bạn không ở trong hội thoại này')
    const lastRead = String(res.rows[0].last_read_message_id)
    await this.core.broadcast(conversationId, 'conv.read', { conversationId, userId, lastReadMessageId: lastRead })
    return { lastReadMessageId: lastRead }
  }

  private async assertGroupMember(client: PoolClient, userId: string, conversationId: string) {
    const m = await this.core.membership(client, userId, conversationId)
    if (!m) throw new ForbiddenException('Bạn không ở trong hội thoại này')
    if (m.type !== 'group') throw new BadRequestException('Chỉ áp dụng cho nhóm chat')
    return m
  }

  private async validUsers(client: PoolClient, ids: string[]): Promise<string[]> {
    if (!ids.length) return []
    const res = await client.query(`SELECT id FROM users WHERE id = ANY($1::uuid[]) AND account_type = 'human' AND status = 'active'`, [
      Array.from(new Set(ids))
    ])
    return res.rows.map((r) => r.id)
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
}

