/**
 * N7AI Agent Engine — Types & Definitions
 * Các kiểu dữ liệu cốt lõi cho Session, Events, và Tool Execution.
 */
import type { LoopConfig, LoopState } from '../core/contracts'
import { validateConfig } from '../core/contracts'

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
  _context_snapshot?: string
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
    parameters: JsonRecord
  }
}

export interface ToolSpec {
  schema: ToolSchema
  sensitive?: string[]
  native?: boolean
  readOnly?: boolean
  handler?: (args: JsonRecord, signal: AbortSignal) => Promise<string | ToolResult>
}

export interface ContextSeed {
  system: string
  history: Message[]
  snapshots?: Record<string, string>
  user: Message
  contextWindow?: number
  outputTokens?: number
  model?: string
  route?: JsonRecord
}

export interface N7AgentInput {
  config: LoopConfig
  seed: ContextSeed
  tools: ToolSpec[]
  sessionId: string
  userId: string
  deferOutput?: boolean
  copy?: Record<string, string>
}

export interface EngineEvent {
  type: 'thinking' | 'progress' | 'content' | 'tool_call' | 'tool_result' | 'ask_user' | 'study_card' | 'done' | 'error'
  content: string
  metadata?: JsonRecord
}

export type Emit = (event: EngineEvent) => Promise<void> | void

export interface Round {
  text: string
  reasoning: string
  toolCalls: ToolCall[]
  usage: { prompt_tokens: number; completion_tokens: number }
  finishReason: string
  trace?: JsonRecord
}

export interface ToolResult {
  content: string
  success: boolean
  metadata?: JsonRecord
  sources?: JsonRecord[]
  pause?: JsonRecord | null
  terminate?: boolean
}

export interface N7AgentResult {
  state: LoopState
  response: string
  reasoning: string
  completed: boolean
  sources: JsonRecord[]
  usage: { prompt_tokens: number; completion_tokens: number }
  toolCalls: { name: string; ok: boolean }[]
  pausePayload?: JsonRecord | null
}

export function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

export function validateAgentInput(input: unknown): N7AgentInput {
  if (!input || typeof input !== 'object') throw new Error('Missing agent input')
  const i = input as Record<string, unknown>
  return {
    ...i,
    config: validateConfig(i.config),
    seed: (i.seed as ContextSeed) || { system: '', history: [], user: { role: 'user', content: '' } },
    tools: Array.isArray(i.tools) ? (i.tools as ToolSpec[]) : [],
    sessionId: String(i.sessionId || ''),
    userId: String(i.userId || ''),
    copy: (i.copy as Record<string, string>) || {}
  } as N7AgentInput
}
