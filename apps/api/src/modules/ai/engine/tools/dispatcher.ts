/**
 * N7AI Agent Engine — Tool Dispatcher
 * Điều phối thực thi công cụ: batching công cụ chỉ đọc, chạy tuần tự công cụ ghi, cache bộ đệm và xử lý tạm dừng ask_user.
 */
import type { Emit, JsonRecord, ToolCall, ToolResult, ToolSpec } from '../native/types'
import { executeAskUser } from './ask-user'

export class ToolDispatcher {
  readonly calls: { name: string; ok: boolean }[] = []
  readonly executedSources: JsonRecord[] = []
  private readonly cache = new Map<string, Promise<ToolResult>>()
  private readonly toolMap = new Map<string, ToolSpec>()
  private pausedPayload: JsonRecord | null = null

  constructor(
    tools: ToolSpec[],
    private readonly emit: Emit,
    private readonly signal: AbortSignal,
    private readonly onResult: (call: ToolCall, output: ToolResult) => Promise<void>
  ) {
    for (const tool of tools) {
      this.toolMap.set(tool.schema.function.name, tool)
    }
  }

  get isPaused(): boolean {
    return this.pausedPayload !== null
  }

  get pausePayload(): JsonRecord | null {
    return this.pausedPayload
  }

  async dispatch(pending: ToolCall[]): Promise<{ pause: boolean }> {
    this.signal.throwIfAborted()
    let hasPause = false

    // Chia nhóm các công cụ để batching (read-only chạy song song tối đa 3, write chạy tuần tự)
    for (let index = 0; index < pending.length; ) {
      this.signal.throwIfAborted()
      const first = pending[index++]
      const firstSpec = this.toolMap.get(first.name)
      const chunk = [first]

      if (firstSpec?.readOnly) {
        while (index < pending.length && chunk.length < 3) {
          const next = pending[index]
          if (this.toolMap.get(next.name)?.readOnly) {
            chunk.push(pending[index++])
          } else {
            break
          }
        }
      }

      const results = await Promise.all(chunk.map((call) => this.runSingle(call)))
      for (let i = 0; i < chunk.length; i++) {
        const call = chunk[i]
        const res = results[i]
        await this.onResult(call, res)
        if (res.pause) {
          this.pausedPayload = res.pause
          hasPause = true
        }
        if (res.sources?.length) {
          this.executedSources.push(...res.sources)
        }
      }

      if (hasPause) break
    }

    return { pause: hasPause }
  }

  private async runSingle(call: ToolCall): Promise<ToolResult> {
    const summary = { name: call.name, ok: false }
    this.calls.push(summary)

    await this.emit({
      type: 'tool_call',
      content: `Đang chạy công cụ: ${call.name}`,
      metadata: { id: call.id, toolName: call.name, status: 'running' }
    })

    let args: JsonRecord = {}
    try {
      args = JSON.parse(call.arguments || '{}')
    } catch {
      args = {}
    }

    // Xử lý riêng công cụ tương tác ask_user
    if (call.name === 'ask_user') {
      try {
        const askResult = executeAskUser(args)
        summary.ok = true
        await this.emit({
          type: 'ask_user',
          content: 'N7AI cần thêm thông tin để tiếp tục',
          metadata: { questions: (askResult.pause as any)?.questions }
        })
        return askResult
      } catch (err: any) {
        return { content: `Lỗi ask_user: ${err?.message}`, success: false }
      }
    }

    const spec = this.toolMap.get(call.name)
    if (!spec || !spec.handler) {
      return {
        content: `Công cụ ${call.name} không khả dụng trong lượt này.`,
        success: false
      }
    }

    const isReadOnly = Boolean(spec.readOnly)
    const cacheKey = `${call.name}:${JSON.stringify(args)}`

    let task = isReadOnly ? this.cache.get(cacheKey) : undefined
    if (!task) {
      task = (async () => {
        try {
          const raw = await spec.handler!(args, this.signal)
          if (typeof raw === 'string') {
            return { content: raw, success: true }
          }
          return raw
        } catch (err: any) {
          return { content: `Lỗi thực thi công cụ: ${err?.message}`, success: false }
        }
      })()

      if (isReadOnly) {
        this.cache.set(cacheKey, task)
      }
    }

    const res = await task
    summary.ok = res.success

    await this.emit({
      type: 'tool_result',
      content: res.success ? `Hoàn thành: ${call.name}` : `Lỗi: ${call.name}`,
      metadata: { id: call.id, toolName: call.name, status: res.success ? 'done' : 'error', success: res.success }
    })

    return res
  }
}

