/**
 * N7AI agent engine — N7AgentService.
 * Vòng agent duy nhất của N7AI (chat chính, nhóm chat, tóm tắt bài viết). Lõi:
 * bộ lập lịch 2 pha (thăm dò → tổng hợp), tự phục hồi khi cụt / rỗng / suy nghĩ ăn hết ngân sách,
 * ask_user, và capability theo chế độ học.
 */
import { Injectable, Logger } from '@nestjs/common'
import type { AiConnectorId, AiMode, AiRunTimings, AiStep } from '@pu/schemas'
import { agentToolPrompt } from '../agent-prompt'
import { AgentToolRunner } from '../agent-tool-runner'
import { mergeToolSessions, type AgentToolSession } from '../agent-tools'
import { GoogleMcpService } from '../connectors/google-mcp.service'
import { PuConnectorMcpService } from '../connectors/pu-connector-mcp.service'
import { LlmService, MAX_OUTPUT_TOKENS, type LlmMessage, type LlmUsage } from '../llm.service'
import { McpModelError } from './errors'
import { capabilityFor } from './capabilities'
import { estimateText } from './context/conversation'
import { LOOP_PROTOCOL, composeSystem } from './prompt/foundation'
import { N7AgentSession, ReasoningBudgetExhausted } from './native/n7-session'
import { TOOL_REJECTED_STATUSES } from './native/model-round'
import { ASK_USER_SCHEMA } from './tools/ask-user'
import { record, type AskUserPause, type ContextSeed, type EngineEvent, type JsonRecord, type Message, type ToolCall, type ToolSchema } from './native/types'

const parseArgs = (raw: string): JsonRecord => {
  try {
    return record(JSON.parse(raw || '{}'))
  } catch {
    return {}
  }
}

// Tài liệu / nguồn dài hơn ngưỡng này ⇒ tóm lược một lần trước vòng đầu để model nắm toàn cục
const BRIEF_THRESHOLD_CHARS = 24_000
const BRIEF_INPUT_CHARS = 60_000

export interface EngineStreamOptions {
  research?: boolean
  model?: string
  aiMode?: AiMode
  /** false ⇒ không cấp ask_user (nhóm chat: nhiều người cùng đọc, không có "người trả lời" duy nhất) */
  askUser?: boolean
  /** Tin người dùng gửi thêm khi đang trả lời (rỗng ⇒ không có) */
  drainInputs?: () => Promise<string[]>
  /** Gỡ lỗi hiển thị: nhận mọi sự kiện suy nghĩ */
  onThinking?: (delta: string) => void
}

export interface EngineStreamResult {
  finishReason: string | null
  usage: LlmUsage
  timings: AiRunTimings
  calls: { name: string; ok: boolean }[]
  steps: AiStep[]
  reasoning: string
  askUser: AskUserPause | null
  /** Số vòng model đã chạy */
  rounds: number
}

const textOf = (content: unknown): string =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : '')).join('\n') : ''

@Injectable()
export class N7AgentService {
  private readonly logger = new Logger(N7AgentService.name)

  constructor(
    private readonly llm: LlmService,
    private readonly mcp: GoogleMcpService,
    private readonly puConnector?: PuConnectorMcpService
  ) {}

  async stream(
    messages: LlmMessage[],
    userId: string,
    connectors: AiConnectorId[],
    emit: (text: string) => void,
    onSteps: (steps: AiStep[]) => void = () => undefined,
    local: AgentToolSession[] = [],
    options: EngineStreamOptions = {}
  ): Promise<EngineStreamResult> {
    if (!this.llm.client) throw new Error('disabled')
    const research = !!options.research
    const maxCalls = research ? 12 : 8
    const signal = AbortSignal.timeout(research ? 120_000 : 90_000)
    const timings: AiRunTimings = { modelWaitMs: 0, modelStreamMs: 0, toolWallMs: 0, mcpOpenMs: 0, rounds: 0, toolCalls: 0, cacheHits: 0 }
    const opening = Date.now()
    const session = mergeToolSessions([
      await this.mcp.open(userId, connectors, signal, { lazy: true }),
      ...(connectors.includes('pu_connector') && this.puConnector ? [this.puConnector.open(userId, signal)] : []),
      ...local
    ])
    timings.mcpOpenMs = Date.now() - opening
    const runner = new AgentToolRunner(session, signal, maxCalls, timings, onSteps)
    try {
      const capability = capabilityFor(options.aiMode, research)
      const own = new Map((capability?.tools ?? []).map((t) => [t.schema.function.name, t]))
      // Đọc lại mỗi vòng: nguồn tool mở lười (Google) lộ thêm công cụ sau lần dò danh mục đầu tiên
      const tools = (): ToolSchema[] => [
        ...session.tools.flatMap((t) => (t.type === 'function' ? [{ type: 'function' as const, function: t.function as ToolSchema['function'] }] : [])),
        ...(capability?.tools.map((t) => t.schema) ?? []),
        ...(options.askUser === false ? [] : [ASK_USER_SCHEMA])
      ]

      // Lô tool: công cụ của capability chạy tại chỗ, còn lại qua runner (bước hiển thị, cache, giới hạn); giữ nguyên thứ tự
      const execute = async (calls: ToolCall[], enabled: boolean): Promise<string[]> => {
        const outputs = new Array<string>(calls.length)
        const external: { index: number; call: ToolCall }[] = []
        calls.forEach((call, index) => {
          const mine = own.get(call.name)
          if (!mine) {
            const args = parseArgs(call.arguments)
            const refusal = capability?.guard?.(call.name, args)
            if (refusal) outputs[index] = JSON.stringify({ error: refusal })
            else external.push({ index, call: capability?.rewrite ? { ...call, arguments: JSON.stringify(capability.rewrite(call.name, args)) } : call })
            return
          }
          try {
            outputs[index] = mine.run(JSON.parse(call.arguments || '{}') as Record<string, unknown>)
          } catch {
            outputs[index] = JSON.stringify({ error: 'Đối số không hợp lệ' })
          }
        })
        if (external.length) {
          const results = await runner.batch(external.map((e) => e.call), enabled)
          external.forEach((e, i) => {
            outputs[e.index] = results[i]
            capability?.observe?.(e.call.name, results[i])
          })
        }
        return outputs
      }

      const system = composeSystem([
        tools().length > 0 || session.instructions.length ? agentToolPrompt(session.instructions) : null,
        LOOP_PROTOCOL,
        capability?.block
      ])
      const rest = [...messages]
      const original = rest[0]?.role === 'system' ? rest.shift() : undefined
      const current = rest.pop() ?? { role: 'user', content: '' }
      const user = await this.brief(current, signal)
      const seed: ContextSeed = {
        system: composeSystem([system, typeof original?.content === 'string' ? original.content : '']),
        history: rest as Message[],
        user: user as Message,
        outputTokens: MAX_OUTPUT_TOKENS,
        model: options.model
      }
      const budgets = { explorationBudget: 3, settlementBudget: 1, emptyRecoveryBudget: 2, ...capability?.budgets }

      const engine = new N7AgentSession(
        this.llm,
        { config: budgets, seed, tools, execute, policy: capability?.policy, openingTool: capability?.openingTool, drainInputs: options.drainInputs },
        (event: EngineEvent) => {
          if (event.type === 'content') emit(event.content)
          else if (event.type === 'thinking') options.onThinking?.(event.content)
        },
        signal
      )
      let result
      try {
        result = await engine.run()
      } catch (error) {
        if (error instanceof ReasoningBudgetExhausted) {
          this.logger.warn('Model dùng hết ngân sách đầu ra cho suy nghĩ hai lần liên tiếp')
          return { finishReason: 'length', usage: { prompt_tokens: 0, completion_tokens: 0 }, timings, calls: runner.calls, steps: runner.steps, reasoning: '', askUser: null, rounds: timings.rounds }
        }
        const status = (error as { status?: number } | null)?.status
        if (tools().length && status !== undefined && TOOL_REJECTED_STATUSES.includes(status)) throw new McpModelError()
        throw error
      }
      timings.rounds += result.rounds
      timings.modelWaitMs += result.timings.modelWaitMs
      timings.modelStreamMs += result.timings.modelStreamMs
      return {
        finishReason: result.askUser ? 'stop' : result.completed ? result.finishReason : result.response.trim() ? result.finishReason : 'length',
        usage: result.usage,
        timings,
        calls: runner.calls,
        steps: runner.steps,
        reasoning: result.reasoning,
        askUser: result.askUser,
        rounds: result.rounds
      }
    } finally {
      timings.mcpOpenMs += session.connectionMs?.() ?? 0
      await session.close().catch(() => undefined)
    }
  }

  // Pre-pass: tài liệu / nguồn rất dài ⇒ một lượt tóm lược khách quan để làm ngữ cảnh đầu vòng
  private async brief(current: LlmMessage, signal: AbortSignal): Promise<LlmMessage> {
    const text = textOf(current.content)
    if (text.length < BRIEF_THRESHOLD_CHARS) return current
    try {
      const { text: summary } = await this.llm.complete(
        [
          { role: 'system', content: 'Tóm lược khách quan tài liệu dưới đây thành tối đa 400 từ tiếng Việt: chủ đề, cấu trúc, ý chính, số liệu / công thức / thuật ngữ quan trọng. Không thêm ý kiến, không trả lời câu hỏi của người dùng.' },
          { role: 'user', content: text.slice(0, BRIEF_INPUT_CHARS) }
        ],
        Math.min(1200, estimateText(text))
      )
      if (!summary) return current
      const block = `<brief>\nTóm lược tài liệu (để nắm toàn cục; chi tiết nằm ở phần dưới):\n${summary}\n</brief>\n\n`
      if (typeof current.content === 'string') return { ...current, content: block + current.content }
      if (Array.isArray(current.content)) return { ...current, content: [{ type: 'text', text: block }, ...current.content] } as LlmMessage
      return current
    } catch (error) {
      if (signal.aborted) throw error
      this.logger.warn(`Pre-pass tóm lược thất bại: ${(error as Error).message?.slice(0, 120)}`)
      return current
    }
  }
}
