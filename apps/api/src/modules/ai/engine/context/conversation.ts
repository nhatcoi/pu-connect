/**
 * N7AI Agent Engine — Conversation Context & Token Budget
 * Quản lý lịch sử hội thoại, tính toán token budget, cắt tỉa an toàn không làm hỏng tool calls.
 */
import type { ContextSeed, JsonRecord, Message, Round, ToolSpec } from '../native/types'

const SNIPPED = '[Kết quả công cụ trước đó đã được lược bớt để vừa giới hạn context window. Gọi lại công cụ nếu cần thiết.]'

/** Ước lượng token thô (tránh nạp tokenizer nặng vào runtime): ASCII ~ 3 ký tự / token, Tiếng Việt/Unicode ~ 1-2 ký tự / token */
export function estimateText(text: string): number {
  let ascii = 0
  let other = 0
  for (const char of text) {
    if (char.codePointAt(0)! < 128) ascii++
    else other++
  }
  return Math.ceil(ascii / 3 + other * 1.5)
}

export function estimateValue(value: unknown): number {
  if (typeof value === 'string') return estimateText(value)
  if (Array.isArray(value)) return value.reduce((sum, x) => sum + estimateValue(x), 0)
  if (value && typeof value === 'object') {
    const x = value as JsonRecord
    if (['image_url', 'input_image', 'image'].includes(String(x.type))) return 1024
    return Object.entries(x).reduce((sum, [key, v]) => sum + estimateText(key) + estimateValue(v), 0)
  }
  return value == null ? 0 : 1
}

export class Conversation {
  readonly messages: Message[]
  readonly turnStart: number
  private lastBudget: JsonRecord = {}

  constructor(readonly seed: ContextSeed) {
    this.messages = [{ role: 'system', content: seed.system }, ...seed.history]
    this.turnStart = this.messages.length

    // Thêm các context snapshot nếu có thay đổi
    if (seed.snapshots) {
      for (const [name, value] of Object.entries(seed.snapshots)) {
        this.messages.push({
          role: 'user',
          content: value,
          _context_snapshot: name
        })
      }
    }

    this.messages.push(structuredClone(seed.user))
  }

  appendInstruction(text: string): void {
    const last = this.messages.at(-1)
    if (last?.role === 'user' && typeof last.content === 'string') {
      last.content = `${last.content.trimEnd()}\n\n${text}`
    } else {
      this.messages.push({ role: 'user', content: text })
    }
  }

  appendAssistant(round: Round): void {
    const message: Message = { role: 'assistant', content: round.text || null }
    if (round.toolCalls.length) {
      message.tool_calls = round.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments }
      }))
    }
    if (round.reasoning) {
      message.reasoning_content = round.reasoning
    }
    this.messages.push(message)
  }

  beginTools(calls: { id: string; name: string }[]): void {
    this.messages.push(
      ...calls.map((call) => ({
        role: 'tool' as const,
        tool_call_id: call.id,
        content: ''
      }))
    )
  }

  resolveTool(id: string, content: string): void {
    const match = this.messages.find((m) => m.role === 'tool' && m.tool_call_id === id)
    if (match) {
      match.content = content
    } else {
      this.messages.push({ role: 'tool', tool_call_id: id, content })
    }
  }

  /**
   * Chiếu và cắt tỉa tin nhắn cũ nếu vượt quá context window
   * Đảm bảo luôn giữ system message đầu tiên và user message mới nhất.
   */
  project(_tools: ToolSpec[]): { messages: Message[]; snipped: boolean } {
    const limit = this.seed.contextWindow || 32_000
    const out = structuredClone(this.messages)
    let snipped = false

    const totalEstimate = () => out.reduce((n, m) => n + estimateValue(m.content), 0)

    // Nếu quá dài, lược bớt nội dung của các tool messages cũ trước
    if (totalEstimate() > limit) {
      for (let i = 0; i < this.turnStart; i++) {
        if (out[i].role === 'tool' && typeof out[i].content === 'string' && (out[i].content as string).length > 200) {
          out[i].content = SNIPPED
          snipped = true
          if (totalEstimate() <= limit) break
        }
      }
    }

    // Nếu vẫn quá dài, bỏ dần các cặp tin nhắn cũ (sau system)
    while (totalEstimate() > limit && out.length > 3) {
      const firstNonSystem = out.findIndex((m) => m.role !== 'system')
      if (firstNonSystem >= 0 && firstNonSystem < out.length - 2) {
        out.splice(firstNonSystem, 1)
        snipped = true
      } else {
        break
      }
    }

    return { messages: out, snipped }
  }

  checkpoint(): Message[] {
    return structuredClone(this.messages)
  }

  budget(): JsonRecord {
    return {
      messageCount: this.messages.length,
      estimatedTokens: this.messages.reduce((n, m) => n + estimateValue(m.content), 0)
    }
  }
}
