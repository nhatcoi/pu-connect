import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { ChatMessage, ConversationSummary } from '@pu/schemas'
import { ChatCoreService } from '../chat-core.service'
import { ConversationsService } from './conversations.service'

// Nhóm học ↔ nhóm chat: mỗi nhóm học 1 nhóm chat, tạo lười khi thành viên mở lần đầu.
// Nguồn sự thật về thành viên = study_group_members (rời chat vẫn mở lại được nếu còn trong nhóm học)
@Injectable()
export class StudyGroupChatService {
  private readonly logger = new Logger(StudyGroupChatService.name)

  constructor(
    private readonly core: ChatCoreService,
    private readonly conversations: ConversationsService
  ) {}

  private get db() {
    return this.core.db
  }

  // Mở nhóm chat của nhóm học: tạo nếu chưa có, đưa người mở vào lại nếu đã rời
  async open(userId: string, groupId: string): Promise<ConversationSummary> {
    const { conversationId, events } = await this.db.transaction(async (client) => {
      // Khóa hàng nhóm học ⇒ 2 người mở cùng lúc không tạo 2 nhóm chat
      const g = await client.query(`SELECT id, name, leader_id FROM study_groups WHERE id = $1 AND status <> 'disbanded' FOR UPDATE`, [groupId])
      const group = g.rows[0]
      if (!group) throw new NotFoundException('Không tìm thấy nhóm học')
      const member = await client.query(`SELECT 1 FROM study_group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId])
      if (!member.rows[0]) throw new ForbiddenException('Chỉ thành viên nhóm học mới vào được nhóm chat')

      const existing = await client.query(`SELECT id FROM conversations WHERE study_group_id = $1`, [groupId])
      if (existing.rows[0]) {
        const joined = await this.addMember(client, existing.rows[0].id, userId)
        return { conversationId: existing.rows[0].id as string, events: joined ? [joined] : [] }
      }
      const created = await this.create(client, group)
      return { conversationId: created.id, events: [created.system] }
    })
    await this.publish(conversationId, events)
    return this.conversations.get(userId, conversationId)
  }

  // Có người vào nhóm học ⇒ thêm vào nhóm chat (nếu đã tạo). Best-effort: lỗi không làm hỏng việc tham gia
  async onStudyGroupJoined(groupId: string, userId: string): Promise<void> {
    try {
      const result = await this.db.transaction(async (client) => {
        const c = await client.query(`SELECT id FROM conversations WHERE study_group_id = $1`, [groupId])
        if (!c.rows[0]) return null
        const system = await this.addMember(client, c.rows[0].id, userId)
        return system ? { conversationId: c.rows[0].id as string, system } : null
      })
      if (result) await this.publish(result.conversationId, [result.system])
    } catch (err) {
      this.logger.warn(`sync study group ${groupId} → chat failed: ${(err as Error).message}`)
    }
  }

  // Tạo nhóm chat + thêm toàn bộ thành viên nhóm học (trưởng nhóm học = trưởng nhóm chat)
  private async create(client: PoolClient, group: { id: string; name: string; leader_id: string }): Promise<{ id: string; system: ChatMessage }> {
    const conv = await client.query(
      `INSERT INTO conversations (type, title, created_by, study_group_id) VALUES ('group', $1, $2, $3) RETURNING id`,
      [group.name, group.leader_id, group.id]
    )
    const id = conv.rows[0].id as string
    await client.query(
      `INSERT INTO conversation_members (conversation_id, user_id, role)
       SELECT $1, m.user_id, CASE WHEN m.user_id = $2 THEN 'owner' ELSE 'member' END
       FROM study_group_members m WHERE m.group_id = $3`,
      [id, group.leader_id, group.id]
    )
    const system = await this.core.insertSystem(client, id, null, `Nhóm chat của nhóm học "${group.name}" đã được tạo`, { event: 'group.created' })
    return { id, system }
  }

  // Thêm / đưa lại 1 người vào nhóm chat; trả tin hệ thống nếu thực sự có thay đổi
  private async addMember(client: PoolClient, conversationId: string, userId: string): Promise<ChatMessage | null> {
    const res = await client.query(
      `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL, role = 'member', joined_at = NOW()
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
