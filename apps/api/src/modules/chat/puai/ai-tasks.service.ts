import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { AiConnectorId, AiTask, AiTaskInput } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { ConversationsService } from '../conversations/conversations.service'
import { AI_TASK_LIMIT } from '../dto/puai.dto'
import { MessagesService } from '../messages/messages.service'
import { nextRunAt } from './ai-tasks.schedule'

const COLUMNS = `id, user_id, title, prompt, skill_id, connectors, frequency, to_char(run_time, 'HH24:MI') AS run_time, weekday, enabled,
  conversation_id, next_run_at, last_run_at, last_status, fail_count`
const MAX_FAILS = 3 // lỗi liên tiếp ⇒ tự tạm dừng
const BATCH = 20

const mapTask = (r: any): AiTask => ({
  id: r.id,
  title: r.title,
  prompt: r.prompt,
  skillId: r.skill_id,
  connectors: r.connectors,
  frequency: r.frequency,
  runTime: r.run_time,
  weekday: r.weekday,
  enabled: r.enabled,
  conversationId: r.conversation_id,
  nextRunAt: new Date(r.next_run_at).toISOString(),
  lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
  lastStatus: r.last_status
})

// Tác vụ tự động của PU AI: hằng ngày / hằng tuần lúc HH:MM (giờ VN), kết quả vào 1 thread riêng + Web Push
@Injectable()
export class AiTasksService {
  private readonly logger = new Logger(AiTasksService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService
  ) {}

  async list(userId: string): Promise<AiTask[]> {
    const res = await this.db.query(`SELECT ${COLUMNS} FROM ai_tasks WHERE user_id = $1 ORDER BY created_at`, [userId])
    return res.rows.map(mapTask)
  }

  async create(userId: string, input: AiTaskInput): Promise<AiTask> {
    await this.assertSkill(userId, input.skillId)
    const res = await this.db.query(
      `INSERT INTO ai_tasks (user_id, title, prompt, skill_id, connectors, frequency, run_time, weekday, enabled, next_run_at)
       SELECT $1, $2, $3, $4, $5, $6, $7::time, $8, $9, $10 WHERE (SELECT COUNT(*) FROM ai_tasks WHERE user_id = $1) < $11
       RETURNING ${COLUMNS}`,
      [...this.values(userId, input), AI_TASK_LIMIT]
    )
    if (!res.rows[0]) throw new BadRequestException(`Tối đa ${AI_TASK_LIMIT} tác vụ`)
    return mapTask(res.rows[0])
  }

  // Sửa ⇒ tính lại lần chạy kế tiếp, xóa đếm lỗi (bật lại sau khi tự tạm dừng)
  async update(userId: string, id: string, input: AiTaskInput): Promise<AiTask> {
    await this.assertSkill(userId, input.skillId)
    const res = await this.db.query(
      `UPDATE ai_tasks SET title = $2, prompt = $3, skill_id = $4, connectors = $5, frequency = $6, run_time = $7::time,
         weekday = $8, enabled = $9, next_run_at = $10, fail_count = 0
       WHERE user_id = $1 AND id = $11 RETURNING ${COLUMNS}`,
      [...this.values(userId, input), id]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tác vụ')
    return mapTask(res.rows[0])
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(`DELETE FROM ai_tasks WHERE id = $1 AND user_id = $2 RETURNING 1`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tác vụ')
    return { deleted: true }
  }

  // "Chạy ngay" (không đổi lịch)
  async runNow(userId: string, id: string): Promise<AiTask> {
    const res = await this.db.query(`SELECT ${COLUMNS} FROM ai_tasks WHERE id = $1 AND user_id = $2`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tác vụ')
    return this.execute(res.rows[0])
  }

  // Worker: nhận các tác vụ đến hạn (SKIP LOCKED ⇒ nhiều tiến trình không chạy trùng), dời lịch rồi chạy lần lượt
  async runDue(): Promise<number> {
    const due = await this.db.transaction(async (client) => {
      const res = await client.query(
        `SELECT ${COLUMNS} FROM ai_tasks WHERE enabled AND next_run_at <= NOW() ORDER BY next_run_at LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [BATCH]
      )
      for (const t of res.rows) {
        await client.query(`UPDATE ai_tasks SET next_run_at = $2 WHERE id = $1`, [
          t.id,
          nextRunAt({ frequency: t.frequency, runTime: t.run_time, weekday: t.weekday })
        ])
      }
      return res.rows
    })
    for (const t of due) await this.execute(t).catch((err) => this.logger.warn(`Tác vụ ${t.id} lỗi: ${err?.message}`))
    return due.length
  }

  // Đăng câu hỏi vào thread của tác vụ (tạo nếu chưa có / đã bị xóa) rồi chờ PU AI trả lời
  private async execute(t: any): Promise<AiTask> {
    let conversationId: string | null = t.conversation_id
    if (!conversationId) {
      conversationId = await this.conversations.createTaskThread(t.user_id, `⏰ ${t.title}`)
      await this.db.query(`UPDATE ai_tasks SET conversation_id = $2 WHERE id = $1`, [t.id, conversationId])
    }
    const outcome = await this.messages
      .sendAsTask(t.user_id, conversationId, { content: t.prompt, skillId: t.skill_id ?? undefined, connectors: t.connectors }, { id: t.id, title: t.title })
      .catch(() => 'error' as const)
    const res = await this.db.query(
      `UPDATE ai_tasks SET last_run_at = NOW(), last_status = $2::varchar,
         fail_count = CASE WHEN $2::varchar = 'error' THEN fail_count + 1 ELSE 0 END,
         enabled = CASE WHEN $2::varchar = 'error' AND fail_count + 1 >= $3 THEN FALSE ELSE enabled END
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [t.id, outcome, MAX_FAILS]
    )
    return mapTask(res.rows[0])
  }

  private values(userId: string, input: AiTaskInput): unknown[] {
    const weekday = input.frequency === 'weekly' ? (input.weekday ?? 0) : null
    return [
      userId,
      input.title,
      input.prompt,
      input.skillId ?? null,
      input.connectors as AiConnectorId[],
      input.frequency,
      input.runTime,
      weekday,
      input.enabled,
      nextRunAt({ frequency: input.frequency, runTime: input.runTime, weekday })
    ]
  }

  private async assertSkill(userId: string, skillId: string | null | undefined) {
    if (!skillId) return
    const res = await this.db.query(`SELECT 1 FROM ai_skills WHERE id = $1 AND owner_id = $2`, [skillId, userId])
    if (!res.rows[0]) throw new BadRequestException('Skill không tồn tại')
  }
}
