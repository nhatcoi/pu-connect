import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { Stream } from 'openai/streaming'
import type { AiQuota } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import type { AiRef, AiTrigger } from './ai.constants'

const DEFAULT_MODEL = 'n7ai-fast' // Model suy nghĩ qua gateway OpenAI-compatible; đổi bằng AI_MODEL
export const MAX_OUTPUT_TOKENS = 8192 // Gồm cả token suy nghĩ (thinking counts toward cap)

export const RESEARCH_TASK = 'research'
export const RESEARCH_COST = 2 // truy xuất sâu + câu trả lời dài ⇒ tốn gấp đôi

export type LlmMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
export type LlmUsage = { prompt_tokens: number; completion_tokens: number }

const PRIMARY_COOLDOWN_MS = 60_000 // gateway chính lỗi ⇒ 60s dùng thẳng gateway dự phòng / primary down ⇒ skip it for 60s
const withV1 = (url?: string) => (url && !/\/v1\/?$/.test(url) ? url.replace(/\/+$/, '') + '/v1' : url)

// Cho model biết tên model N7AI đang chạy (người dùng hỏi "bạn là model gì") — nối vào system prompt đầu tiên
const identityLine = (name: string) => `\n\nBạn đang chạy model ${name} của N7AI. Hỏi về model ⇒ nói đúng tên này, không nhận là model hay hãng khác.`
function withIdentity(messages: LlmMessage[], name: string): LlmMessage[] {
  const i = messages.findIndex((m) => m.role === 'system' && typeof m.content === 'string')
  if (i < 0) return [{ role: 'system', content: identityLine(name).trim() }, ...messages]
  return messages.map((m, j) => (j === i ? { ...m, content: (m.content as string) + identityLine(name) } : m)) as LlmMessage[]
}

// Lõi gọi LLM dùng chung: client, model, tài khoản @n7ai, quota/ngày và nhật ký ai_runs
// Shared LLM core: one client, one quota across chat, comments and summaries
@Injectable()
export class LlmService {
  readonly client: OpenAI | null
  readonly model: string
  private readonly fallback: OpenAI | null
  private readonly fallbackModel: string
  private primaryDownUntil = 0
  private readonly dailyQuota: number
  private readonly logger = new Logger(LlmService.name)
  private botId: string | null = null

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    // Chưa cấu hình key ⇒ client = null, nơi gọi trả lời thông báo thay vì lỗi
    const apiKey = config.get<string>('AI_API_KEY')
    const baseURL = withV1(config.get<string>('AI_BASE_URL') || undefined)
    this.client = apiKey ? new OpenAI({ apiKey, baseURL, timeout: 120_000, maxRetries: 1 }) : null
    this.model = config.get<string>('AI_MODEL') || DEFAULT_MODEL
    // Gateway dự phòng (tùy chọn): AI_FALLBACK_BASE_URL + AI_FALLBACK_API_KEY (+ AI_FALLBACK_MODEL)
    const fbKey = config.get<string>('AI_FALLBACK_API_KEY')
    const fbUrl = withV1(config.get<string>('AI_FALLBACK_BASE_URL') || undefined)
    this.fallback = fbKey && fbUrl ? new OpenAI({ apiKey: fbKey, baseURL: fbUrl, timeout: 120_000, maxRetries: 0 }) : null
    this.fallbackModel = config.get<string>('AI_FALLBACK_MODEL') || this.model
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

  async startRun(input: { requesterId: string; trigger: AiTrigger; task: string; source?: AiRef; reply?: AiRef; model?: string }): Promise<string> {
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
        input.model ?? this.model
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

  // Lỗi gateway (mất kết nối, timeout, 401/404/429/5xx) ⇒ đáng thử gateway dự phòng; 400/422 là lỗi yêu cầu, không thử lại
  private isGatewayFailure(err: unknown): boolean {
    if (err instanceof OpenAI.APIConnectionError) return true
    return err instanceof OpenAI.APIError && [401, 403, 404, 408, 429].concat(err.status && err.status >= 500 ? [err.status] : []).includes(err.status ?? 0)
  }

  // Gọi chat completion: gateway chính trước, lỗi gateway ⇒ gateway dự phòng (model riêng); params.model do nơi gọi không cần đặt
  async chat(params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, 'model'>, options?: { signal?: AbortSignal; model?: string }): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>>
  async chat(params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>, options?: { signal?: AbortSignal; model?: string }): Promise<OpenAI.Chat.Completions.ChatCompletion>
  async chat(params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParams, 'model'>, options?: { signal?: AbortSignal; model?: string }) {
    if (!this.client) throw new Error('disabled')
    const { model: tier, ...request } = options ?? {}
    // Mức model chỉ có trên gateway chính; gateway dự phòng dùng model dự phòng chung
    const primaryModel = tier ?? this.model
    const run = (client: OpenAI, model: string) => {
      const name = model === primaryModel ? model : `${primaryModel} (dự phòng)`
      return client.chat.completions.create({ ...params, messages: withIdentity(params.messages, name), model } as OpenAI.Chat.Completions.ChatCompletionCreateParams, request)
    }
    if (!this.fallback) return run(this.client, primaryModel)
    if (Date.now() < this.primaryDownUntil) return run(this.fallback, this.fallbackModel)
    try {
      return await run(this.client, primaryModel)
    } catch (err) {
      if (request.signal?.aborted || !this.isGatewayFailure(err)) throw err
      this.primaryDownUntil = Date.now() + PRIMARY_COOLDOWN_MS
      this.logger.warn(`AI gateway chính lỗi (${(err as Error).message?.slice(0, 120)}), chuyển sang gateway dự phòng`)
      return run(this.fallback, this.fallbackModel)
    }
  }

  // Gọi 1 lần, không stream (bình luận, tóm tắt)
  async complete(messages: LlmMessage[], maxTokens = MAX_OUTPUT_TOKENS): Promise<{ text: string; finishReason: string | null; usage?: LlmUsage }> {
    const res = await this.chat({ max_tokens: maxTokens, messages })
    const choice = res.choices[0]
    return { text: (choice?.message?.content || '').trim(), finishReason: choice?.finish_reason ?? null, usage: res.usage }
  }

  // Lỗi tạm thời từ gateway (quá tải, mất kết nối, 5xx)
  isBusyError(err: unknown): boolean {
    return err instanceof OpenAI.RateLimitError || err instanceof OpenAI.APIConnectionError || (err instanceof OpenAI.APIError && (err.status ?? 0) >= 500)
  }
}
