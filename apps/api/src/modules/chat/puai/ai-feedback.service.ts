import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { AiFeedbackInput, AiFeedbackStats, AiSupportInput, AiUsage } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { LlmService, RESEARCH_COST, RESEARCH_TASK } from '../../ai/llm.service'
import { ChatCoreService } from '../chat-core.service'

const CONTEXT_MESSAGES = 10

// Phản hồi & hỗ trợ PU AI: 👍/👎 từng câu trả lời, gửi báo lỗi / góp ý, lượt dùng 7 ngày, thống kê cho admin
@Injectable()
export class AiFeedbackService {
  constructor(
    private readonly db: DatabaseService,
    private readonly core: ChatCoreService,
    private readonly llm: LlmService
  ) {}

  // Chấm câu trả lời của PU AI (người trong hội thoại); thread AI riêng ⇒ lưu luôn vào meta để hiện lại sau khi tải trang
  async rate(userId: string, messageId: string, input: AiFeedbackInput): Promise<{ rating: 1 | -1 }> {
    const res = await this.db.query(
      `SELECT m.conversation_id, c.type FROM messages m JOIN conversations c ON c.id = m.conversation_id
       JOIN conversation_members me ON me.conversation_id = c.id AND me.user_id = $2 AND me.left_at IS NULL
       WHERE m.id = $1 AND m.kind = 'ai' AND m.deleted_at IS NULL`,
      [messageId, userId]
    )
    const row = res.rows[0]
    if (!row) throw new NotFoundException('Không tìm thấy câu trả lời')
    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO ai_feedback (message_id, user_id, rating, reason, comment) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (message_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, reason = EXCLUDED.reason, comment = EXCLUDED.comment, created_at = NOW()`,
        [messageId, userId, input.rating, input.rating < 0 ? (input.reason ?? null) : null, input.comment ?? null]
      )
      if (row.type === 'ai') {
        await client.query(`UPDATE messages SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('feedback', $2::int) WHERE id = $1`, [
          messageId,
          input.rating
        ])
      }
    })
    if (row.type === 'ai') await this.core.broadcast(row.conversation_id, 'message.updated', await this.core.fetchMessage(this.db, messageId))
    return { rating: input.rating }
  }

  // Báo lỗi / góp ý; includeContext ⇒ đính kèm ≤ 10 tin gần nhất của hội thoại (phải là thành viên)
  async support(userId: string, input: AiSupportInput): Promise<{ id: string }> {
    let context: unknown = null
    if (input.conversationId && input.includeContext) {
      if (!(await this.core.isMember(userId, input.conversationId))) throw new ForbiddenException('Bạn không ở trong hội thoại này')
      const msgs = await this.db.query(
        `SELECT kind, left(content, 2000) AS content, created_at FROM messages
         WHERE conversation_id = $1 AND deleted_at IS NULL AND kind <> 'system' ORDER BY id DESC LIMIT $2`,
        [input.conversationId, CONTEXT_MESSAGES]
      )
      context = msgs.rows.reverse()
    }
    const res = await this.db.query(
      `INSERT INTO ai_support_tickets (user_id, category, message, conversation_id, context) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, input.category, input.message, input.conversationId ?? null, context ? JSON.stringify(context) : null]
    )
    return { id: res.rows[0].id }
  }

  // Lượt dùng hôm nay + 7 ngày gần nhất (giờ VN, Research tính 2)
  async usage(userId: string): Promise<AiUsage> {
    const [quota, days] = await Promise.all([
      this.llm.quota(userId),
      this.db.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS date, COALESCE(SUM(CASE WHEN r.task = '${RESEARCH_TASK}' THEN ${RESEARCH_COST} ELSE 1 END), 0)::int AS count
         FROM generate_series((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 6, (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, interval '1 day') d
         LEFT JOIN ai_runs r ON r.requester_id = $1 AND r.status <> 'rejected' AND (r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d::date
         GROUP BY d ORDER BY d`,
        [userId]
      )
    ])
    return { used: quota.used, limit: quota.limit, days: days.rows }
  }

  // Admin: tỉ lệ 👍/👎 30 ngày + lý do + 20 ticket mới nhất
  async stats(): Promise<AiFeedbackStats> {
    const [counts, reasons, tickets] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) FILTER (WHERE rating = 1)::int AS up, COUNT(*) FILTER (WHERE rating = -1)::int AS down
         FROM ai_feedback WHERE created_at > NOW() - interval '30 days'`
      ),
      this.db.query(
        `SELECT COALESCE(reason, 'other') AS reason, COUNT(*)::int AS n FROM ai_feedback
         WHERE rating = -1 AND created_at > NOW() - interval '30 days' GROUP BY 1`
      ),
      this.db.query(
        `SELECT t.id, t.category, left(t.message, 300) AS message, t.status, t.created_at, u.username
         FROM ai_support_tickets t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC LIMIT 20`
      )
    ])
    return {
      up: counts.rows[0].up,
      down: counts.rows[0].down,
      byReason: Object.fromEntries(reasons.rows.map((r) => [r.reason, r.n])),
      tickets: tickets.rows.map((t) => ({
        id: t.id,
        category: t.category,
        message: t.message,
        status: t.status,
        createdAt: new Date(t.created_at).toISOString(),
        user: t.username
      }))
    }
  }
}
