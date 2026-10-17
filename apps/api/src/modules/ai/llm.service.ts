import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { AiQuota } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import type { AiRef, AiTrigger } from './ai.constants'

const DEFAULT_MODEL = 'v9' // Model suy nghĩ qua gateway OpenAI-compatible; đổi bằng AI_MODEL
export const MAX_OUTPUT_TOKENS = 8192 // Gồm cả token suy nghĩ (thinking counts toward cap)

export const RESEARCH_TASK = 'research'
export const RESEARCH_COST = 2 // truy xuất sâu + câu trả lời dài ⇒ tốn gấp đôi

export type LlmMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
export type LlmUsage = { prompt_tokens: number; completion_tokens: number }

// Lõi gọi LLM dùng chung: client, model, tài khoản @n7ai, quota/ngày và nhật ký ai_runs
// Shared LLM core: one client, one quota across chat, comments and summaries
@Injectable()
export class LlmService {
  readonly client: OpenAI | null
  readonly model: string
  private readonly dailyQuota: number
  private botId: string | null = null

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    // Chưa cấu hình key ⇒ client = null, nơi gọi trả lời thông báo thay vì lỗi
    const apiKey = config.get<string>('AI_API_KEY')
    let baseURL = config.get<string>('AI_BASE_URL') || undefined
    if (baseURL && !baseURL.endsWith('/v1') && !baseURL.endsWith('/v1/')) {
      baseURL = baseURL.replace(/\/+$/, '') + '/v1'
    }
    this.client = apiKey ? new OpenAI({ apiKey, baseURL, timeout: 120_000, maxRetries: 1 }) : null
    this.model = config.get<string>('AI_MODEL') || DEFAULT_MODEL
    this.dailyQuota = Number(config.get('AI_DAILY_QUOTA') || 30)
  }

  async getBotId(): Promise<string> {
    if (this.botId) return this.botId
    const res = await this.db.query(`SELECT id FROM users WHERE username = 'n7ai' AND account_type = 'bot' LIMIT 1`)
    if (!res.rows[0]) throw new Error('Thiếu tài khoản @n7ai (chạy messaging-upgrade.sql)')
    this.botId = res.rows[0].id as string
    return this.botId
  }

  // Lượt đã dùng hôm nay (theo giờ Việt Nam), tính chung mọi nơi gọi N7AI; Research tính 2 lượt
  async quota(userId: string): Promise<AiQuota> {
    const res = await this.db.query(
      `SELECT COALESCE(SUM(CASE WHEN task = '${RESEARCH_TASK}' THEN ${RESEARCH_COST} ELSE 1 END), 0)::int AS used FROM ai_runs
       WHERE requester_id = $1 AND status <> 'rejected'
         AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
      [userId]
    )
    return { used: res.rows[0].used, limit: this.dailyQuota, enabled: !!this.client }
  }

  async hasQuota(userId: string): Promise<boolean> {
    const { used, limit } = await this.quota(userId)
    return used < limit
  }

  // Ghi lượt bị từ chối (hết quota) — không tính vào quota
  async logRejected(requesterId: string, trigger: AiTrigger) {
    await this.db.query(`INSERT INTO ai_runs (bot_id, requester_id, trigger, status, model) VALUES ($1, $2, $3, 'rejected', $4)`, [
      await this.getBotId(),
      requesterId,
      trigger,
      this.model
    ])
  }

  async startRun(input: { requesterId: string; trigger: AiTrigger; task: string; source?: AiRef; reply?: AiRef }): Promise<string> {
    const res = await this.db.query(
      `INSERT INTO ai_runs (bot_id, requester_id, trigger, task, source_ref, reply_ref, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        await this.getBotId(),
        input.requesterId,
        input.trigger,
        input.task,
        input.source ? JSON.stringify(input.source) : null,
        input.reply ? JSON.stringify(input.reply) : null,
        this.model
      ]
    )
    return res.rows[0].id
  }

  async finishRun(runId: string, result: { usage?: LlmUsage; startedAt: number; reply?: AiRef }) {
    await this.db.query(
      `UPDATE ai_runs SET status = 'done', input_tokens = $2, output_tokens = $3, latency_ms = $4,
                          reply_ref = COALESCE($5, reply_ref), finished_at = NOW()
       WHERE id = $1`,
      [
        runId,
        result.usage?.prompt_tokens ?? 0,
        result.usage?.completion_tokens ?? 0,
        Date.now() - result.startedAt,
        result.reply ? JSON.stringify(result.reply) : null
      ]
    )
  }

  async failRun(runId: string, error: unknown, startedAt: number) {
    await this.db.query(`UPDATE ai_runs SET status = 'error', error = $2, latency_ms = $3, finished_at = NOW() WHERE id = $1`, [
      runId,
      String((error as Error)?.message || error).slice(0, 500),
      Date.now() - startedAt
    ])
  }

  // Gọi 1 lần, không stream (bình luận, tóm tắt)
  async complete(messages: LlmMessage[], maxTokens = MAX_OUTPUT_TOKENS): Promise<{ text: string; finishReason: string | null; usage?: LlmUsage }> {
    if (!this.client) throw new Error('disabled')
    const res = await this.client.chat.completions.create({ model: this.model, max_tokens: maxTokens, messages })
    const choice = res.choices[0]
    return { text: (choice?.message?.content || '').trim(), finishReason: choice?.finish_reason ?? null, usage: res.usage }
  }

  // Lỗi tạm thời từ gateway (quá tải, mất kết nối, 5xx)
  isBusyError(err: unknown): boolean {
    return err instanceof OpenAI.RateLimitError || err instanceof OpenAI.APIConnectionError || (err instanceof OpenAI.APIError && (err.status ?? 0) >= 500)
  }
}
