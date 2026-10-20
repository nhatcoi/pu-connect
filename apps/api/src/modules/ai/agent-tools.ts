import type OpenAI from 'openai'
import type { AiStep } from '@pu/schemas'

export type AgentTool = OpenAI.Chat.Completions.ChatCompletionTool
export type AgentStepInfo = Pick<AiStep, 'provider' | 'label' | 'detail'>

// Một nguồn tool cho vòng lặp model (Google MCP, Học tập của tôi…); tên tool có tiền tố `${provider}__`
// One tool source for the model loop; every session is per-user and per-reply; readOnly explicitly opts tools into scheduling
export interface AgentToolSession {
  tools: AgentTool[]
  // Explicit opt-in: only read tools may run concurrently or reuse an in-turn result.
  readOnly?: (name: string) => boolean
  connectionMs?: () => number
  // Chỉ dẫn hệ thống riêng của nguồn (+ lỗi kết nối cần báo thật cho người dùng)
  instructions: string[]
  // Bước hiển thị cho tool đã cấp trong lượt (null ⇒ không thuộc nguồn này)
  describe: (name: string, args: Record<string, unknown>) => AgentStepInfo | null
  call: (name: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<string>
  close: () => Promise<void>
}

// Gộp nhiều nguồn: tool đi tới đúng nguồn đã khai báo nó
export function mergeToolSessions(sessions: AgentToolSession[]): AgentToolSession {
  const owner = (name: string) => sessions.find((s) => s.tools.some((t) => t.type === 'function' && t.function.name === name))
  return {
    get tools() {
      return sessions.flatMap((s) => s.tools)
    },
    connectionMs: () => sessions.reduce((total, s) => total + (s.connectionMs?.() ?? 0), 0),
    readOnly: (name) => owner(name)?.readOnly?.(name) === true,
    instructions: sessions.flatMap((s) => s.instructions),
    describe: (name, args) => owner(name)?.describe(name, args) ?? null,
    call: (name, args, signal) =>
      owner(name)?.call(name, args, signal) ?? Promise.resolve(JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })),
    close: async () => {
      await Promise.allSettled(sessions.map((s) => s.close()))
    }
  }
}
