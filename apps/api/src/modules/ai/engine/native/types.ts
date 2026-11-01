/**
 * Agent engine — kiểu dữ liệu cốt lõi cho phiên, sự kiện, vòng gọi model và công cụ.
 */
import type { LoopConfig, LoopState } from '../core/contracts'

export type JsonRecord = Record<string, unknown>

export interface Message extends JsonRecord {
  role: string
  content?: unknown
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  reasoning_content?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ToolSchema {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: JsonRecord
  }
}

/** Lời nhắc hệ thống chèn vào hội thoại ở từng tình huống (cấu hình được; có mặc định tiếng Việt). */
export interface EngineCopy {
  settle: string
  finish: string
  continueTruncated: string
  continueReasoning: string
  emptyNudge: string
  toolBatchTruncated: string
  toolLimit: string
  toolDuplicate: string
  toolsClosed: string
  contextShortened: string
  userSentWhileWorking: string
}

/** Thực thi một lô tool call; trả kết quả (chuỗi JSON) đúng thứ tự gọi. `enabled=false` ⇒ từ chối mọi call. */
export type ToolExecutor = (calls: ToolCall[], enabled: boolean) => Promise<string[]>

/** Móc chính sách của capability: chạy khi model muốn kết thúc (không còn tool call). */
export interface LoopPolicy {
  /** Trả về chỉ dẫn ⇒ chưa cho kết thúc, model phải làm tiếp theo chỉ dẫn (tối đa một lần / lượt). */
  checkFinish?: (text: string) => string | null
  /** Sau mỗi lô tool: true ⇒ kết thúc lượt ngay (vd. tool chốt kết quả). */
  afterTools?: (names: string[]) => { terminate: boolean }
}

export interface ContextSeed {
  system: string
  history: Message[]
  user: Message
  /** Cửa sổ ngữ cảnh ước lượng (token) dùng để cắt tỉa; mặc định 100k */
  contextWindow?: number
  /** Giới hạn token đầu ra cho MỖI vòng (gồm cả token suy nghĩ) */
  outputTokens: number
  model?: string
}

export interface N7AgentInput {
  config: LoopConfig
  seed: ContextSeed
  /** Schema tool gửi cho model (kể cả ask_user); dạng hàm ⇒ đọc lại mỗi vòng (nguồn tool mở lười: danh mục lộ ra giữa lượt) */
  tools: ToolSchema[] | (() => ToolSchema[])
  execute: ToolExecutor
  copy?: Partial<EngineCopy>
  policy?: LoopPolicy
  sessionId?: string
  /** Gọi đầu mỗi vòng (trừ vòng đầu): tin người dùng gửi thêm khi agent đang làm việc ⇒ đưa vào ngữ cảnh vòng sau */
  drainInputs?: () => Promise<string[]>
}

export interface EngineEvent {
  type: 'thinking' | 'content' | 'progress' | 'ask_user'
  content: string
  metadata?: JsonRecord
}

export type Emit = (event: EngineEvent) => Promise<void> | void

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
}

export interface Round {
  text: string
  reasoning: string
  toolCalls: ToolCall[]
  usage: Usage
  /** true ⇒ gateway không trả usage, số liệu là ước lượng */
  usageEstimated: boolean
  finishReason: string
  /** Chờ chunk đầu tiên (gồm suy nghĩ ẩn) và thời gian stream sau đó, ms */
  waitMs: number
  streamMs: number
}

export interface AskUserPause {
  questions: unknown[]
}

export interface N7AgentResult {
  state: LoopState
  /** Chữ hiển thị cho người dùng (đã nối các đoạn "tiếp tục") */
  response: string
  /** Suy nghĩ của model gom lại (hiện ở khối "Xem quá trình") */
  reasoning: string
  completed: boolean
  finishReason: string
  usage: Usage
  rounds: number
  askUser: AskUserPause | null
  timings: { modelWaitMs: number; modelStreamMs: number }
}

export function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}
