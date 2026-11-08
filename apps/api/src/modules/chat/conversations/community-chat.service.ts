import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { ChatMessage, ConversationSummary } from '@pu/schemas'
import { ChatCoreService } from '../chat-core.service'
import { ConversationsService } from './conversations.service'

// Cộng đồng ↔ nhóm chat: mỗi cộng đồng 1 nhóm chat, tạo lười khi thành viên mở lần đầu.
// Nguồn sự thật về thành viên = community_members; rời cộng đồng ⇒ rời nhóm chat (CommunitiesService / CommunityManagementService đồng bộ trong transaction)
@Injectable()
export class CommunityChatService {
  constructor(
    private readonly core: ChatCoreService,
    private readonly conversations: ConversationsService
  ) {}

  private get db() {
    return this.core.db
  }

  async open(userId: string, slug: string): Promise<ConversationSummary> {
    const { conversationId, events } = await this.db.transaction(async (client) => {
      // Khóa hàng cộng đồng ⇒ 2 người mở cùng lúc không tạo 2 nhóm chat
      const c = await client.query(`SELECT id, name FROM communities WHERE slug = $1 AND status = 'active' FOR UPDATE`, [slug.toLowerCase().trim()])
      const community = c.rows[0]
      if (!community) throw new NotFoundException('Không tìm thấy cộng đồng')
      const member = await client.query(`SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`, [community.id, userId])
      if (!member.rows[0]) throw new ForbiddenException('Chỉ thành viên cộng đồng mới vào được nhóm chat')

      const existing = await client.query(`SELECT id FROM conversations WHERE community_id = $1`, [community.id])
      if (existing.rows[0]) {
        const joined = await this.addMember(client, existing.rows[0].id, userId)
        return { conversationId: existing.rows[0].id as string, events: joined ? [joined] : [] }
      }
      const created = await this.create(client, community, userId)
      return { conversationId: created.id, events: [created.system] }
    })
    await this.publish(conversationId, events)
    return this.conversations.get(userId, conversationId)
  }

  private async create(client: PoolClient, community: { id: string; name: string }, ownerId: string): Promise<{ id: string; system: ChatMessage }> {
    const conv = await client.query(`INSERT INTO conversations (type, title, created_by, community_id) VALUES ('group', $1, $2, $3) RETURNING id`, [
      community.name,
      ownerId,
      community.id
    ])
    const id = conv.rows[0].id as string
    // Chỉ đưa người mở lần đầu vào ngay; thành viên khác vào khi tự mở (tránh kéo hàng nghìn người vào chat không mong muốn)
    await client.query(`INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'owner')`, [id, ownerId])
    const system = await this.core.insertSystem(client, id, null, `Nhóm chat của cộng đồng "${community.name}" đã được tạo`, { event: 'group.created' })
    return { id, system }
  }

  private async addMember(client: PoolClient, conversationId: string, userId: string): Promise<ChatMessage | null> {
    const res = await client.query(
      `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL, joined_at = NOW()
         WHERE conversation_members.left_at IS NOT NULL
       RETURNING user_id`,
      [conversationId, userId]
    )
    if (!res.rows[0]) return null
    const [name] = await this.core.displayNames(client, [userId])
    return this.core.insertSystem(client, conversationId, userId, `${name} đã tham gia nhóm chat`, { event: 'member.added', targetNames: [name] })
  }

  private async publish(conversationId: string, events: ChatMessage[]) {
    if (!events.length) return
    for (const m of events) await this.core.broadcast(conversationId, 'message.new', m)
    await this.core.broadcast(conversationId, 'conv.updated', { conversationId })
  }
}
