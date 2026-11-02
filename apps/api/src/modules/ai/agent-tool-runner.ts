import type { AiRunTimings, AiStep } from '@pu/schemas'
import type { AgentToolSession } from './agent-tools'
import { toolError } from './agent-tool-args'

export interface PendingToolCall {
  id: string
  name: string
  arguments: string
}

// Số kết quả của 1 lượt tìm: data là mảng ⇒ độ dài; object ⇒ tổng các mảng con; khác (đọc 1 mục, MCP) ⇒ không đếm
export function countResults(data: unknown): number | undefined {
  if (Array.isArray(data)) return data.length
  if (!data || typeof data !== 'object') return undefined
  const lists = Object.values(data).filter(Array.isArray)
  return lists.length ? lists.reduce((n, l) => n + l.length, 0) : undefined
}

// Lý do ngắn của một lệnh tool thất bại (lỗi + vấn đề đầu tiên) để hiện cạnh bước và để chẩn đoán lần sau
export function failureDetail(result: string): string | undefined {
  try {
    const parsed = JSON.parse(result) as { error?: unknown; issues?: unknown }
    const error = typeof parsed.error === 'string' ? parsed.error : undefined
    const issue = Array.isArray(parsed.issues) && typeof parsed.issues[0] === 'string' ? parsed.issues[0] : undefined
    const joined = [error, issue].filter(Boolean).join(': ')
    return joined ? joined.slice(0, 140) : undefined
  } catch {
    return undefined
  }
}

// Stable keys make JSON property order irrelevant. Cache lives only in this account's reply.
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, v]) => [key, canonical(v)])
        )
      : value

export class AgentToolRunner {
  readonly calls: { name: string; ok: boolean }[] = []
  readonly steps: AiStep[] = []
  resultChars = 0
  private readonly cache = new Map<string, Promise<string>>()
  // Tool báo nguồn lỗi (unavailable) ⇒ không gọi lại trong lượt này (model hay đổi từ khóa thử lại nhiều lần)
  private readonly unavailable = new Set<string>()

  constructor(
    private readonly session: AgentToolSession,
    private readonly signal: AbortSignal,
    private readonly maxCalls: number,
    private readonly timings: AiRunTimings,
    private readonly onSteps: (steps: AiStep[]) => void
  ) {}

  async batch(pending: PendingToolCall[], enabled: boolean): Promise<string[]> {
    const started = Date.now()
    const results: string[] = []
    // Only explicit read tools share a batch. Writes are barriers and keep their order.
    for (let index = 0; index < pending.length;) {
      const chunk = [pending[index++]]
      if (this.session.readOnly?.(chunk[0].name)) {
        while (index < pending.length && chunk.length < 3 && this.session.readOnly?.(pending[index].name)) chunk.push(pending[index++])
      }
      results.push(...(await Promise.all(chunk.map((call) => this.run(call, enabled)))))
    }
    this.timings.toolWallMs += Date.now() - started
    return results
  }

  private publish() {
    this.onSteps(this.steps.map((s) => ({ ...s })))
  }

  private async run(call: PendingToolCall, enabled: boolean) {
    // Reserve before awaiting: concurrent calls cannot overrun the per-turn budget.
    const summary = { name: call.name, ok: false }
    if (!enabled || this.calls.length >= this.maxCalls || this.resultChars >= 48_000 || this.signal.aborted)
      return toolError('Đã đạt giới hạn gọi công cụ trong lượt hỏi')
    if (this.unavailable.has(call.name)) return toolError('Nguồn này vừa lỗi trong lượt hỏi, không gọi lại; trả lời bằng dữ liệu đã có')
    this.calls.push(summary)
    let step: AiStep | undefined
    const started = Date.now()
    let result: string
    try {
      const args: unknown = JSON.parse(call.arguments || '{}')
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid arguments')
      const params = args as Record<string, unknown>
      const info = this.session.describe(call.name, params)
      if (info) {
        step = { id: call.id, ...info, status: 'running' }
        this.steps.push(step)
        this.publish()
      }
      const readOnly = this.session.readOnly?.(call.name) === true
      const operationSignal = readOnly ? AbortSignal.any([this.signal, AbortSignal.timeout(15_000)]) : this.signal
      const key = `${call.name}:${JSON.stringify(canonical(params))}`
      let task = readOnly ? this.cache.get(key) : undefined
      if (task) this.timings.cacheHits++
      else {
        this.timings.toolCalls++
        task = this.session.call(call.name, params, operationSignal)
        if (readOnly) this.cache.set(key, task)
      }
      result = await waitForTool(task, operationSignal)
      const parsed = JSON.parse(result) as { error?: unknown; isError?: boolean; unavailable?: boolean; data?: { error?: unknown } }
      if (parsed.unavailable) this.unavailable.add(call.name)
      summary.ok = !parsed.error && !parsed.isError && !parsed.data?.error
      if (step && summary.ok && readOnly) {
        const count = countResults(parsed.data)
        if (count !== undefined) step.resultCount = count
      }
      if (!readOnly) this.cache.clear()
      if (!summary.ok || result.length > 16_000) this.cache.delete(key)
      if (result.length > 16_000) {
        summary.ok = false
        result = toolError('Kết quả vượt giới hạn, thu hẹp truy vấn hoặc đọc từng mục')
      }
    } catch {
      result = toolError('Không thực hiện được công cụ: tham số không hợp lệ hoặc kết nối bị gián đoạn')
      this.cache.clear() // A rejected single-flight must not poison retries.
    }
    if (this.resultChars + result.length > 48_000) {
      result = toolError('Đã đạt ngân sách kết quả công cụ, trả lời từ dữ liệu đã có')
      summary.ok = false
    }
    this.resultChars += result.length
    if (step) {
      step.status = summary.ok ? 'done' : 'error'
      if (!summary.ok) step.detail = failureDetail(result) ?? step.detail
      step.durationMs = Date.now() - started
      this.publish()
    }
    return result
  }
}

// Bound waiting; provider transports also enforce their own request timeout.
function waitForTool(task: Promise<string>, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) {
      task.catch(() => undefined)
      reject(signal.reason)
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
