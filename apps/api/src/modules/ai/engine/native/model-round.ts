/**
 * Agent engine — một vòng gọi model streaming: bóc suy nghĩ, thu tool call, đo usage.
 */
import { Logger } from '@nestjs/common'
import type OpenAI from 'openai'
import type { LlmService } from '../../llm.service'
import { HostFailure } from '../core/contracts'
import type { Conversation } from '../context/conversation'
import { estimateText } from '../context/conversation'
import { ThinkFilter } from '../providers/think-filter'
import { MAX_CALL_ARGS } from './copy'
import type { Emit, Round, ToolCall, ToolSchema } from './types'

export interface ModelRoundOptions {
  model?: string
  signal: AbortSignal
  emit: Emit
  conversation: Conversation
  tools: ToolSchema[]
  /** false ⇒ vẫn gửi danh sách tool (lịch sử có tool call) nhưng đặt tool_choice = none */
  toolsAllowed: boolean
  /** Ép model gọi tool này (chỉ khi toolsAllowed và tool có trong danh sách) */
  forceTool?: string
  outputTokens: number
  /** Gỡ thông báo "đã rút gọn ngữ cảnh" */
  onSnipped?: () => Promise<void> | void
}

// Luồng / kết nối bị cắt (undici "terminated", socket reset) — khác lỗi model / timeout của lượt. Lần theo chuỗi `cause`: SDK bọc lỗi mạng 2–3 lớp
const DROP_CODES = new Set(['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'])
export const isStreamDrop = (err: unknown) => {
  for (let e = err as { message?: string; name?: string; code?: string; cause?: unknown } | null, depth = 0; e && depth < 4; e = e.cause as typeof e, depth++) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError' || e.name === 'APIConnectionTimeoutError') return false
    if ((e.code && DROP_CODES.has(e.code)) || /terminated|socket|ECONNRESET|premature close/i.test(e.message ?? '')) return true
  }
  return false
}

export const TOOL_REJECTED_STATUSES = [400, 422]

const logger = new Logger('N7ModelRound')

export async function executeModelRound(llm: LlmService, options: ModelRoundOptions): Promise<Round> {
  const { model, signal, emit, conversation, tools, toolsAllowed, outputTokens } = options
  signal.throwIfAborted()

  const projected = conversation.project()
  if (projected.snipped) await options.onSnipped?.()

  const messages = projected.messages.map((m) => {
    const out: Record<string, unknown> = { role: m.role, content: (m.content as unknown) ?? '' }
    if (m.tool_calls) out.tool_calls = m.tool_calls
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id
    return out
  }) as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[]

  let forced = !!options.forceTool && toolsAllowed && tools.some((t) => t.function.name === options.forceTool)
  const makeBody = () => ({
    messages,
    max_tokens: outputTokens,
    stream: true as const,
    stream_options: { include_usage: true },
    ...(tools.length
      ? {
          tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
          tool_choice: forced ? { type: 'function' as const, function: { name: options.forceTool as string } } : toolsAllowed ? ('auto' as const) : ('none' as const)
        }
      : {})
  })

  const started = Date.now()
  let firstChunkAt: number | undefined
  const filter = new ThinkFilter()
  let visible = ''
  let reasoning = ''
  let finishReason = 'stop'
  let reported: Round['usage'] | null = null
  const pending = new Map<number, ToolCall>()
  let retried = false

  for (;;) {
    try {
      const stream = await llm.chat(makeBody(), { signal, model })
      for await (const chunk of stream) {
        signal.throwIfAborted()
        if (chunk.usage) reported = { prompt_tokens: chunk.usage.prompt_tokens ?? 0, completion_tokens: chunk.usage.completion_tokens ?? 0 }
        const choice = chunk.choices?.[0]
        if (choice?.finish_reason) finishReason = choice.finish_reason
        const delta = choice?.delta as (OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta & { reasoning_content?: string; reasoning?: string }) | undefined
        if (!delta) continue
        if (firstChunkAt === undefined && (delta.content || delta.tool_calls?.length || (delta as { reasoning_content?: string }).reasoning_content)) firstChunkAt = Date.now()

        const native = delta.reasoning_content || delta.reasoning
        if (typeof native === 'string' && native) {
          reasoning += native
          await emit({ type: 'thinking', content: native })
        }
        if (typeof delta.content === 'string' && delta.content) {
          for (const [kind, piece] of filter.feed(delta.content)) {
            if (!piece) continue
            if (kind === 'thinking') {
              reasoning += piece
              await emit({ type: 'thinking', content: piece })
            } else {
              visible += piece
              if (visible.length > 64_000) throw new Error('Model output exceeds turn limit')
              await emit({ type: 'content', content: piece })
            }
          }
        }
        for (const fragment of delta.tool_calls ?? []) {
          const index = fragment.index ?? 0
          const call = pending.get(index) ?? { id: '', name: '', arguments: '' }
          if (fragment.id) call.id += fragment.id
          if (fragment.function?.name) call.name += fragment.function.name
          if (fragment.function?.arguments) call.arguments += fragment.function.arguments
          if (call.arguments.length > MAX_CALL_ARGS) throw new Error('Tool call exceeds size limit')
          pending.set(index, call)
        }
      }
      break
    } catch (error) {
      if (signal.aborted) throw error
      // Gateway đóng luồng trước khi có chữ / tool call ⇒ thử lại đúng một lần, người dùng không thấy lỗi
      if (!retried && !visible && !reasoning && !pending.size && isStreamDrop(error)) {
        retried = true
        continue
      }
      const status = (error as { status?: number } | null)?.status
      // Provider không nhận tool_choice ép ⇒ thử lại một lần với tự chọn
      if (forced && status !== undefined && TOOL_REJECTED_STATUSES.includes(status) && !visible && !reasoning && !pending.size) {
        logger.warn(`tool_choice ép "${options.forceTool}" bị từ chối (${status}), thử lại ở chế độ tự chọn`)
        forced = false
        continue
      }
      if (tools.length && status !== undefined && TOOL_REJECTED_STATUSES.includes(status) && !visible && !pending.size) throw error
      throw new HostFailure(error instanceof Error ? error.message : String(error), 'model-round', visible.length > 0 || pending.size > 0)
    }
  }

  for (const [kind, piece] of filter.feed('', true)) {
    if (!piece) continue
    if (kind === 'thinking') {
      reasoning += piece
      await emit({ type: 'thinking', content: piece })
    } else {
      visible += piece
      await emit({ type: 'content', content: piece })
    }
  }

  const toolCalls = [...pending.values()]
    .filter((c) => c.name)
    .map((c, i) => ({ id: c.id || `call_${Date.now()}_${i}`, name: c.name, arguments: c.arguments.trim() || '{}' }))

  const usage = reported ?? {
    prompt_tokens: conversation.budget().estimatedTokens as number,
    completion_tokens: estimateText(visible) + estimateText(reasoning) + estimateText(toolCalls.map((c) => c.arguments).join(''))
  }
  const ended = Date.now()
  logger.log(
    `round tools=${tools.length} choice=${forced ? `force:${options.forceTool}` : toolsAllowed ? 'auto' : 'none'} → finish=${finishReason} calls=[${toolCalls.map((c) => c.name).join(',')}] text=${visible.length} reasoning=${reasoning.length}`
  )
  const waitMs = (firstChunkAt ?? ended) - started
  return { text: visible, reasoning, toolCalls, usage, usageEstimated: !reported, finishReason, waitMs, streamMs: firstChunkAt ? ended - firstChunkAt : 0 }
}
