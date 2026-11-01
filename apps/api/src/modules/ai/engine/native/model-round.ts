/**
 * N7AI Agent Engine — Model Round
 * Thực thi một vòng gọi LLM streaming, bóc tách thinking và thu thập tool calls.
 */
import type OpenAI from 'openai'
import type { LlmService } from '../../llm.service'
import { ThinkFilter } from '../providers/think-filter'
import type { Conversation } from '../context/conversation'
import type { Emit, Round, ToolCall, ToolSpec } from './types'

export interface ModelRoundOptions {
  settling: boolean
  first: boolean
  model?: string
  signal: AbortSignal
  emit: Emit
  conversation: Conversation
  tools: ToolSpec[]
  toolsAllowed: boolean
  reserveTokens?: number
}

export async function executeModelRound(llm: LlmService, options: ModelRoundOptions): Promise<Round> {
  const { settling, first: _first, model, signal, emit, conversation, tools, toolsAllowed, reserveTokens = 2048 } = options

  signal.throwIfAborted()

  // Project conversation and snip if exceeding token budget
  const projected = conversation.project(tools)
  if (projected.snipped) {
    await emit({
      type: 'progress',
      content: 'Đã tối ưu ngữ cảnh hội thoại để đảm bảo tốc độ phản hồi.',
      metadata: { trace_kind: 'warning' }
    })
  }

  const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = toolsAllowed
    ? tools.map((t) => ({
        type: 'function',
        function: {
          name: t.schema.function.name,
          description: t.schema.function.description,
          parameters: t.schema.function.parameters
        }
      }))
    : []

  const messages = projected.messages.map((m) => {
    const out: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: m.role as any,
      content: (m.content as any) ?? ''
    }
    if (m.tool_calls) (out as any).tool_calls = m.tool_calls
    if (m.tool_call_id) (out as any).tool_call_id = m.tool_call_id
    return out
  })

  const requestBody: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, 'model'> = {
    messages,
    stream: true,
    stream_options: { include_usage: true },
    ...(toolSchemas.length > 0 ? { tools: toolSchemas } : {}),
    ...(settling ? { max_tokens: Math.max(reserveTokens, 2048) } : {})
  }

  const stream = await llm.chat(requestBody, { signal, model })

  const filter = new ThinkFilter()
  let visibleText = ''
  let inlineReasoning = ''
  const pendingCalls = new Map<number, { id: string; name: string; arguments: string }>()
  let finishReason = 'stop'
  const usage = { prompt_tokens: 0, completion_tokens: 0 }

  for await (const chunk of stream) {
    signal.throwIfAborted()

    if (chunk.usage) {
      usage.prompt_tokens = chunk.usage.prompt_tokens || usage.prompt_tokens
      usage.completion_tokens = chunk.usage.completion_tokens || usage.completion_tokens
    }

    const choice = chunk.choices?.[0]
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason
    }

    const delta = choice?.delta
    if (!delta) continue

    // 1. Kiểm tra trường reasoning_content (DeepSeek / OpenRouter native reasoning)
    const nativeReasoning = (delta as any).reasoning_content || (delta as any).reasoning
    if (typeof nativeReasoning === 'string' && nativeReasoning) {
      inlineReasoning += nativeReasoning
      await emit({
        type: 'thinking',
        content: nativeReasoning,
        metadata: { trace_kind: 'native_reasoning' }
      })
    }

    // 2. Lọc thẻ inline <think>...</think> nếu có trong delta.content
    if (typeof delta.content === 'string' && delta.content) {
      const parts = filter.feed(delta.content, false)
      for (const [kind, piece] of parts) {
        if (!piece) continue
        if (kind === 'thinking') {
          inlineReasoning += piece
          await emit({
            type: 'thinking',
            content: piece,
            metadata: { trace_kind: 'inline_think' }
          })
        } else {
          visibleText += piece
          await emit({
            type: 'content',
            content: piece,
            metadata: { trace_kind: 'llm_chunk' }
          })
        }
      }
    }

    // 3. Thu thập tool_calls streaming
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const index = tc.index ?? 0
        let item = pendingCalls.get(index)
        if (!item) {
          item = { id: tc.id || `call_${Date.now()}_${index}`, name: tc.function?.name || '', arguments: '' }
          pendingCalls.set(index, item)
        }
        if (tc.id && !item.id) item.id = tc.id
        if (tc.function?.name) item.name += tc.function.name
        if (tc.function?.arguments) item.arguments += tc.function.arguments
      }
    }
  }

  // Xả nốt buffer pending còn lại trong think filter
  const trailing = filter.feed('', true)
  for (const [kind, piece] of trailing) {
    if (!piece) continue
    if (kind === 'thinking') {
      inlineReasoning += piece
      await emit({ type: 'thinking', content: piece })
    } else {
      visibleText += piece
      await emit({ type: 'content', content: piece })
    }
  }

  const toolCalls: ToolCall[] = Array.from(pendingCalls.values()).filter((c) => c.name.length > 0)

  return {
    text: visibleText,
    reasoning: inlineReasoning,
    toolCalls,
    usage,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : finishReason
  }
}
