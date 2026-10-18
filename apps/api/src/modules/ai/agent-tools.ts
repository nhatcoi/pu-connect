import type OpenAI from 'openai'
import type { AiStep } from '@pu/schemas'

export type AgentTool = OpenAI.Chat.Completions.ChatCompletionTool
export type AgentStepInfo = Pick<AiStep, 'provider' | 'label' | 'detail'>

// Một nguồn tool cho vòng lặp model (Google MCP, Học tập của tôi…); tên tool có tiền tố `${provider}__`
// One tool source for the model loop; every session is per-user, per-reply and read-only
export interface AgentToolSession {
  tools: AgentTool[]
  // Chỉ dẫn hệ thống riêng của nguồn (+ lỗi kết nối cần báo thật cho người dùng)
  instructions: string[]
  // Bước hiển thị cho tool đã cấp trong lượt (null ⇒ không thuộc nguồn này)
  describe: (name: string, args: Record<string, unknown>) => AgentStepInfo | null
  call: (name: string, args: Record<string, unknown>) => Promise<string>
  close: () => Promise<void>
}

// Gộp nhiều nguồn: tool đi tới đúng nguồn đã khai báo nó
export function mergeToolSessions(sessions: AgentToolSession[]): AgentToolSession {
  const owner = (name: string) => sessions.find((s) => s.tools.some((t) => t.type === 'function' && t.function.name === name))
  return {
    tools: sessions.flatMap((s) => s.tools),
    instructions: sessions.flatMap((s) => s.instructions),
    describe: (name, args) => owner(name)?.describe(name, args) ?? null,
    call: (name, args) => owner(name)?.call(name, args) ?? Promise.resolve(JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })),
    close: async () => {
      await Promise.allSettled(sessions.map((s) => s.close()))
    }
  }
}
