/**
 * Agent engine — lịch sử hội thoại của một lượt và chiếu theo ngân sách ngữ cảnh.
 * Cắt tỉa theo NHÓM (user → trả lời → tool) để không bao giờ để lại tool call mồ côi.
 */
import type { ContextSeed, JsonRecord, Message, Round } from '../native/types'

export const SNIPPED = '[Kết quả công cụ trước đó đã được lược bớt để vừa giới hạn ngữ cảnh. Gọi lại công cụ nếu cần.]'
const DEFAULT_WINDOW = 100_000

/** Ước lượng token thô (không nạp tokenizer): ASCII ≈ 3 ký tự / token, ký tự Unicode (tiếng Việt…) ≈ 1,5 token */
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
  if (Array.isArray(value)) return value.reduce((sum: number, x) => sum + estimateValue(x), 0)
  if (value && typeof value === 'object') {
    const x = value as JsonRecord
    if (['image_url', 'input_image', 'image'].includes(String(x.type))) return 1024
    return Object.entries(x).reduce((sum, [key, v]) => sum + estimateText(key) + estimateValue(v), 0)
  }
  return value == null ? 0 : 1
}

const messageTokens = (m: Message) => estimateValue(m.content) + estimateValue(m.tool_calls) + 4

export class Conversation {
  readonly messages: Message[]
  /** Chỉ số tin người dùng của lượt hiện tại: mọi thứ trước đó là lịch sử */
  readonly turnStart: number

  constructor(readonly seed: ContextSeed) {
    this.messages = [{ role: 'system', content: seed.system }, ...seed.history.map((m) => structuredClone(m))]
    this.turnStart = this.messages.length
    this.messages.push(structuredClone(seed.user))
  }

  /** Chỉ dẫn gắn vào cuối tin người dùng gần nhất (hoặc thêm tin mới) để model đọc ở vòng kế */
  appendInstruction(text: string): void {
    const last = this.messages.at(-1)
    if (last?.role === 'user' && typeof last.content === 'string') last.content = `${last.content.trimEnd()}\n\n${text}`
    else this.messages.push({ role: 'user', content: text })
  }

  /** Vòng rỗng (không chữ, không tool) không đưa vào lịch sử: nhiều gateway từ chối tin assistant rỗng */
  appendAssistant(round: Round): void {
    if (!round.text && !round.toolCalls.length) return
    const message: Message = { role: 'assistant', content: round.text || null }
    if (round.toolCalls.length) {
      message.tool_calls = round.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } }))
    }
    this.messages.push(message)
  }

  beginTools(calls: { id: string }[]): void {
    this.messages.push(...calls.map((call) => ({ role: 'tool', tool_call_id: call.id, content: '' }) as Message))
  }

  resolveTool(id: string, content: string): void {
    const match = this.messages.find((m) => m.role === 'tool' && m.tool_call_id === id)
    if (match) match.content = content
    else this.messages.push({ role: 'tool', tool_call_id: id, content })
  }

  /** Bản gửi model: nếu vượt cửa sổ thì lược kết quả tool cũ, rồi bỏ cả nhóm lịch sử cũ nhất */
  project(): { messages: Message[]; snipped: boolean } {
    const limit = this.seed.contextWindow || DEFAULT_WINDOW
    const out = structuredClone(this.messages)
    let snipped = false
    const total = () => out.reduce((n, m) => n + messageTokens(m), 0)

    if (total() > limit) {
      for (let i = 1; i < out.length && total() > limit; i++) {
        const m = out[i]
        if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > 200 && m.content !== SNIPPED) {
          m.content = SNIPPED
          snipped = true
        }
      }
    }

    // Bỏ nguyên nhóm lịch sử cũ nhất (từ một tin user tới trước tin user kế); luôn giữ system + lượt hiện tại
    let currentStart = out.length - (this.messages.length - this.turnStart)
    while (total() > limit) {
      const first = out.findIndex((m, i) => i >= 1 && m.role === 'user')
      if (first < 0 || first >= currentStart) break
      let next = out.findIndex((m, i) => i > first && m.role === 'user')
      if (next < 0 || next > currentStart) next = currentStart
      out.splice(first, next - first)
      currentStart -= next - first
      snipped = true
    }
    return { messages: out, snipped }
  }

  checkpoint(): Message[] {
    return structuredClone(this.messages)
  }

  budget(): { messageCount: number; estimatedTokens: number } {
    return { messageCount: this.messages.length, estimatedTokens: this.messages.reduce((n, m) => n + messageTokens(m), 0) }
  }
}
