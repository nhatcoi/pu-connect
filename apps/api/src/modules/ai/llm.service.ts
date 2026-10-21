import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { Stream } from 'openai/streaming'
import type { AiQuota } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import type { AiRef, AiTrigger } from './ai.constants'
import { AiProviderRegistry } from './ai-provider.registry'
import { AiModelCatalogService } from './ai-model-catalog.service'

const DEFAULT_MODEL = 'n7ai-fast' // Model suy nghĩ qua gateway OpenAI-compatible; đổi bằng AI_MODEL
export const MAX_OUTPUT_TOKENS = 16384 // Gồm cả token suy nghĩ (thinking counts toward cap)

export const RESEARCH_TASK = 'research'
export const RESEARCH_COST = 2 // truy xuất sâu + câu trả lời dài ⇒ tốn gấp đôi

export type LlmMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
export type LlmUsage = { prompt_tokens: number; completion_tokens: number }

// Cho model biết tên model N7AI đang chạy (người dùng hỏi "bạn là model gì") — nối vào system prompt đầu tiên
const identityLine = (name: string) => `\n\nBạn đang chạy model ${name} của N7AI. Hỏi về model ⇒ nói đúng tên này, không nhận là model hay hãng khác.`
function withIdentity(messages: LlmMessage[], name: string): LlmMessage[] {
  const i = messages.findIndex((m) => m.role === 'system' && typeof m.content === 'string')
  if (i < 0) return [{ role: 'system', content: identityLine(name).trim() }, ...messages]
  return messages.map((m, j) => (j === i ? { ...m, content: (m.content as string) + identityLine(name) } : m)) as LlmMessage[]
}

const CHARS_PER_TOKEN = 3 // ước lượng thô, thiên về dư (tiếng Việt ~2–3 ký tự / token)

const textLength = (m: LlmMessage) =>
  (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content ?? '').length) +
  ('tool_calls' in m ? JSON.stringify(m.tool_calls ?? '').length : 0)

// Giữ system + tin mới nhất, bỏ dần tin cũ nhất tới khi vừa giới hạn input của model; không để lại tin `tool` mồ côi
export function fitInput(messages: LlmMessage[], maxTokens: number | null): LlmMessage[] {
  if (!maxTokens) return messages
  const budget = maxTokens * CHARS_PER_TOKEN
  const out = [...messages]
  const total = () => out.reduce((n, m) => n + textLength(m), 0)
  const first = () => out.findIndex((m) => m.role !== 'system')
  while (total() > budget && out.length - out.filter((m) => m.role === 'system').length > 1) {
    const i = first()
    const dropped = out.splice(i, 1)[0]
    if (dropped.role === 'assistant' && 'tool_calls' in dropped && dropped.tool_calls?.length) {
      while (out[i]?.role === 'tool') out.splice(i, 1)
    }
    while (out[first()]?.role === 'tool' && out.length > 1) out.splice(first(), 1)
  }
  return out
}

// Lõi gọi LLM dùng chung: client, model, tài khoản @n7ai, quota/ngày và nhật ký ai_runs
// Shared LLM core: one client, one quota across chat, comments and summaries
@Injectable()
export class LlmService {
  readonly model: string
  private readonly dailyQuota: number
  private readonly logger = new Logger(LlmService.name)
  private botId: string | null = null

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService,
    private readonly providers: AiProviderRegistry = new AiProviderRegistry(db, config),
    private readonly catalog: AiModelCatalogService = new AiModelCatalogService(db)
  ) {
    this.model = config.get<string>('AI_MODEL') || DEFAULT_MODEL
    this.dailyQuota = Number(config.get('AI_DAILY_QUOTA') || 30)
  }

  // Client của provider chính; chưa có provider nào (DB trống, env thiếu key) ⇒ null, nơi gọi trả lời thông báo thay vì lỗi
  get client(): OpenAI | null {
    return this.providers.primaryClient()
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

  // Gọi chat completion: provider chính trước, lỗi gateway ⇒ lần lượt các provider dự phòng (xem AiProviderRegistry)
  // params.model do nơi gọi không cần đặt; options.model = mức model N7AI (provider có modelOverride thì dùng tên riêng)
  async chat(
    params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, 'model'>,
    options?: { signal?: AbortSignal; model?: string }
  ): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk>>
  async chat(
    params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>,
    options?: { signal?: AbortSignal; model?: string }
  ): Promise<OpenAI.Chat.Completions.ChatCompletion>
  async chat(params: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParams, 'model'>, options?: { signal?: AbortSignal; model?: string }) {
    const { model: tier, ...request } = options ?? {}
    const wanted = tier ?? this.model
    const entry = await this.catalog.find(wanted) // provider / tên thật / effort / giới hạn của model; không có ⇒ dùng tên nguyên bản
    const upstream = entry?.upstream ?? wanted
    const chain = await this.providers.chain(entry?.providerId)
    if (!chain.length) throw new Error('disabled')
    const maxOut = entry?.maxOutputTokens
    for (let i = 0; i < chain.length; i++) {
      const p = chain[i]
      const model = entry?.providerId === p.id ? upstream : (p.modelOverride ?? upstream)
      const name = p.primary ? wanted : `${wanted} (dự phòng)`
      const body = {
        ...params,
        messages: withIdentity(fitInput(params.messages, entry?.maxInputTokens ?? null), name),
        model,
        // Effort chỉ gửi khi dùng đúng tên model đã cấu hình (model dự phòng đổi tên có thể không hỗ trợ)
        ...(entry?.effort && model === upstream ? { reasoning_effort: entry.effort } : {}),
        ...(maxOut ? { max_tokens: Math.min(params.max_tokens ?? maxOut, maxOut) } : {})
      }
      try {
        return await p.client.chat.completions.create(body as OpenAI.Chat.Completions.ChatCompletionCreateParams, request)
      } catch (err) {
        // Hết provider / người dùng hủy / lỗi yêu cầu (400, 422) ⇒ báo lỗi thẳng, không thử provider khác
        if (i === chain.length - 1 || request.signal?.aborted || !this.isGatewayFailure(err)) throw err
        this.providers.markDown(p.id)
        this.logger.warn(`AI provider "${p.name}" lỗi (${(err as Error).message?.slice(0, 120)}), chuyển sang provider kế tiếp`)
      }
    }
    throw new Error('disabled') // không tới được (vòng lặp luôn return / throw) nhưng TypeScript cần
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
