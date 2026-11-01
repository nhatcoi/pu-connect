/**
 * Agent engine — điều phối một lô tool call của một vòng:
 * lọc đối số riêng tư, bỏ lệnh trùng, giới hạn số lệnh / vòng, từ chối lô bị cắt, xử lý ask_user.
 */
import { MAX_TOOL_CALLS_PER_ROUND } from '../native/copy'
import type { AskUserPause, EngineCopy, Emit, JsonRecord, ToolCall, ToolExecutor } from '../native/types'
import { record } from '../native/types'
import { askPayload } from './ask-user'

export const ASK_USER = 'ask_user'

const toolError = (message: string) => JSON.stringify({ error: message })

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonRecord)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export interface DispatchOutcome {
  /** Kết quả theo ĐÚNG thứ tự lệnh gọi (để ghép với tool_call_id) */
  results: Map<string, string>
  pause: AskUserPause | null
  /** Tên các tool đã chạy thật (để hook chính sách) */
  executed: string[]
}

export class ToolDispatcher {
  readonly calls: { name: string; ok: boolean }[] = []
  pausePayload: AskUserPause | null = null

  constructor(
    private readonly execute: ToolExecutor,
    private readonly emit: Emit,
    private readonly signal: AbortSignal,
    private readonly copy: EngineCopy
  ) {}

  get isPaused(): boolean {
    return this.pausePayload !== null
  }

  /** `rejection` khác rỗng ⇒ không chạy lệnh nào (lô bị cắt), trả lỗi cho từng lệnh */
  async run(pending: ToolCall[], rejection = ''): Promise<DispatchOutcome> {
    this.signal.throwIfAborted()
    const results = new Map<string, string>()
    const executed: string[] = []
    if (rejection) {
      for (const call of pending) results.set(call.id, toolError(rejection))
      return { results, pause: null, executed }
    }

    const run: ToolCall[] = []
    const seen = new Map<string, string>()
    const duplicates: Array<{ call: ToolCall; of: string }> = []
    let ask: ToolCall | null = null
    for (const [index, call] of pending.entries()) {
      if (index >= MAX_TOOL_CALLS_PER_ROUND) {
        results.set(call.id, toolError(this.copy.toolLimit))
        continue
      }
      // Trường bắt đầu bằng "_" là của máy chủ: model không được tự đặt
      let args: JsonRecord = {}
      let valid = true
      try {
        args = record(JSON.parse(call.arguments || '{}'))
      } catch {
        valid = false
      }
      if (!valid) {
        results.set(call.id, toolError('Đối số của công cụ phải là một đối tượng JSON hợp lệ'))
        continue
      }
      const clean = Object.fromEntries(Object.entries(args).filter(([k]) => !k.startsWith('_')))
      const normalized: ToolCall = { ...call, arguments: JSON.stringify(clean) }
      if (call.name === ASK_USER) {
        ask = ask ?? normalized
        if (ask !== normalized) results.set(call.id, toolError('Chỉ hỏi người dùng một lần mỗi vòng; gộp mọi câu hỏi vào một lệnh ask_user'))
        continue
      }
      const key = `${call.name}:${canonical(clean)}`
      const dup = seen.get(key)
      if (dup) {
        duplicates.push({ call, of: dup })
        continue
      }
      seen.set(key, call.id)
      run.push(normalized)
    }

    if (run.length) {
      const outputs = await this.execute(run, true)
      run.forEach((call, i) => {
        const result = outputs[i] ?? toolError('Công cụ không trả kết quả')
        results.set(call.id, result)
        executed.push(call.name)
        let ok = true
        try {
          const parsed = JSON.parse(result) as { error?: unknown; isError?: boolean }
          ok = !parsed.error && !parsed.isError
        } catch {
          ok = true
        }
        this.calls.push({ name: call.name, ok })
      })
    }
    for (const { call, of } of duplicates) results.set(call.id, results.get(of) ?? toolError(this.copy.toolDuplicate))

    if (ask) {
      try {
        const payload = askPayload(record(JSON.parse(ask.arguments)))
        this.pausePayload = payload as unknown as AskUserPause
        results.set(ask.id, JSON.stringify({ status: 'paused', note: 'Đã gửi câu hỏi cho người dùng; chờ câu trả lời của họ.' }))
        this.calls.push({ name: ASK_USER, ok: true })
        await this.emit({ type: 'ask_user', content: '', metadata: { questions: payload.questions } })
      } catch (err) {
        results.set(ask.id, toolError(`ask_user không hợp lệ: ${err instanceof Error ? err.message : String(err)}`))
        this.calls.push({ name: ASK_USER, ok: false })
      }
    }
    return { results, pause: this.pausePayload, executed }
  }
}
