/**
 * N7AI Agent Engine — Unit Tests
 * ThinkFilter, Conversation, ask_user, dispatcher, RunLoop scheduler, session (model giả) và capability giải bài.
 */
import { ThinkFilter } from '../../src/modules/ai/engine/providers/think-filter'
import { Conversation, SNIPPED, estimateText } from '../../src/modules/ai/engine/context/conversation'
import { askPayload } from '../../src/modules/ai/engine/tools/ask-user'
import { ToolDispatcher } from '../../src/modules/ai/engine/tools/dispatcher'
import { runLoop } from '../../src/modules/ai/engine/core/run-loop'
import type { LoopConfig, LoopHost, Operation, Operations } from '../../src/modules/ai/engine/core/contracts'
import { N7AgentSession, ReasoningBudgetExhausted } from '../../src/modules/ai/engine/native/n7-session'
import { resolveCopy } from '../../src/modules/ai/engine/native/copy'
import { solveCapability } from '../../src/modules/ai/engine/capabilities/solve'
import type { EngineEvent, N7AgentInput, ToolCall } from '../../src/modules/ai/engine/native/types'
import type { LlmService } from '../../src/modules/ai/llm.service'

describe('N7AI Agent Engine Unit Tests', () => {
  describe('ThinkFilter', () => {
    it('splits inline <think> tags accurately', () => {
      const filter = new ThinkFilter()
      const parts = filter.feed('Chào bạn! <think>Tôi đang phân tích câu hỏi</think> Đây là câu trả lời.', true)
      expect(parts).toEqual([
        ['content', 'Chào bạn! '],
        ['thinking', 'Tôi đang phân tích câu hỏi'],
        ['content', ' Đây là câu trả lời.']
      ])
    })

    it('handles tag split across stream deltas', () => {
      const filter = new ThinkFilter()
      const p1 = filter.feed('Bắt đầu <thi')
      const p2 = filter.feed('nk>Đang suy nghĩ sâu</th')
      const p3 = filter.feed('ink> Kết quả!', true)

      const mergedThinking = [...p1, ...p2, ...p3].filter(([k]) => k === 'thinking').map(([, t]) => t).join('')
      const mergedContent = [...p1, ...p2, ...p3].filter(([k]) => k === 'content').map(([, t]) => t).join('')

      expect(mergedThinking).toBe('Đang suy nghĩ sâu')
      expect(mergedContent).toBe('Bắt đầu  Kết quả!')
    })
  })

  describe('Conversation', () => {
    const seed = (history: any[], contextWindow?: number) => ({ system: 'sys', history, user: { role: 'user', content: 'câu hỏi' }, outputTokens: 1000, contextWindow })

    it('ước lượng token cho tiếng Anh và tiếng Việt', () => {
      expect(estimateText('hello world')).toBeGreaterThan(0)
      expect(estimateText('Xin chào Phenikaa')).toBeGreaterThan(estimateText('hello world') / 2)
    })

    it('không đưa vòng rỗng vào lịch sử, giữ cặp tool_call / kết quả', () => {
      const c = new Conversation(seed([]))
      c.appendAssistant({ text: '', reasoning: 'nghĩ', toolCalls: [], usage: { prompt_tokens: 0, completion_tokens: 0 }, usageEstimated: false, finishReason: 'length', waitMs: 0, streamMs: 0 })
      expect(c.messages.at(-1)?.role).toBe('user')
      c.appendAssistant({ text: '', reasoning: '', toolCalls: [{ id: 'a', name: 't', arguments: '{}' }], usage: { prompt_tokens: 0, completion_tokens: 0 }, usageEstimated: false, finishReason: 'tool_calls', waitMs: 0, streamMs: 0 })
      c.beginTools([{ id: 'a' }])
      c.resolveTool('a', 'kết quả')
      expect(c.messages.at(-2)?.tool_calls?.[0].id).toBe('a')
      expect(c.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'a', content: 'kết quả' })
    })

    it('vượt cửa sổ ⇒ lược kết quả tool cũ rồi bỏ NGUYÊN nhóm lịch sử cũ nhất, không để tool mồ côi', () => {
      const big = 'x'.repeat(2000)
      const history = [
        { role: 'user', content: 'cũ 1' },
        { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'f', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 't1', content: big },
        { role: 'assistant', content: 'trả lời cũ 1' },
        { role: 'user', content: 'cũ 2' },
        { role: 'assistant', content: 'trả lời cũ 2' }
      ]
      const snipOnly = new Conversation(seed(history, 600)).project()
      expect(snipOnly.snipped).toBe(true)
      expect(snipOnly.messages.find((m) => m.role === 'tool')?.content).toBe(SNIPPED)

      const dropped = new Conversation(seed(history, 40)).project()
      expect(dropped.snipped).toBe(true)
      const ids = new Set(dropped.messages.flatMap((m) => (m.tool_calls ?? []).map((t) => t.id)))
      for (const m of dropped.messages) if (m.role === 'tool') expect(ids.has(m.tool_call_id as string)).toBe(true)
      expect(dropped.messages[0].role).toBe('system')
      expect(dropped.messages.at(-1)?.content).toBe('câu hỏi')
    })
  })

  describe('ask_user payload', () => {
    it('chuẩn hóa câu hỏi, loại lựa chọn trùng, giới hạn 4 câu', () => {
      const { questions } = askPayload({
        questions: [{ prompt: 'Chọn hướng?', options: [{ label: 'Đại số' }, { label: 'đại số' }, 'Hình học'] }, ...Array.from({ length: 6 }, (_, i) => ({ prompt: `q${i}`, options: [] }))]
      })
      expect(questions).toHaveLength(4)
      expect(questions[0].options.map((o) => o.label)).toEqual(['Đại số', 'Hình học'])
      expect(() => askPayload({ questions: [] })).toThrow()
    })
  })

  describe('ToolDispatcher', () => {
    const run = async (calls: ToolCall[], rejection = '') => {
      const execute = jest.fn(async (list: ToolCall[]) => list.map((c) => JSON.stringify({ ok: c.name })))
      const events: EngineEvent[] = []
      const d = new ToolDispatcher(execute, (e) => void events.push(e), new AbortController().signal, resolveCopy())
      return { d, execute, events, out: await d.run(calls, rejection) }
    }

    it('bỏ lệnh trùng, lọc đối số bắt đầu bằng "_", chạy lệnh duy nhất một lần', async () => {
      const { execute, out } = await run([
        { id: '1', name: 'search', arguments: '{"q":"a","_scope":"x"}' },
        { id: '2', name: 'search', arguments: '{"_scope":"y","q":"a"}' }
      ])
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute.mock.calls[0][0]).toHaveLength(1)
      expect(JSON.parse(execute.mock.calls[0][0][0].arguments)).toEqual({ q: 'a' })
      expect(out.results.get('2')).toBe(out.results.get('1'))
    })

    it('lô bị cắt: không chạy lệnh nào', async () => {
      const { execute, out } = await run([{ id: '1', name: 'search', arguments: '{"q":' }], 'bị cắt')
      expect(execute).not.toHaveBeenCalled()
      expect(JSON.parse(out.results.get('1')!).error).toBe('bị cắt')
    })

    it('tối đa 15 lệnh mỗi vòng, phần vượt không chạy', async () => {
      const calls = Array.from({ length: 17 }, (_, i) => ({ id: `${i}`, name: 'search', arguments: JSON.stringify({ q: i }) }))
      const { execute, out } = await run(calls)
      expect(execute.mock.calls[0][0]).toHaveLength(15)
      expect(JSON.parse(out.results.get('16')!).error).toMatch(/vượt/)
    })

    it('ask_user tạm dừng và phát sự kiện', async () => {
      const { d, execute, events, out } = await run([{ id: 'a', name: 'ask_user', arguments: JSON.stringify({ questions: [{ prompt: 'Chọn?', options: ['A', 'B'] }] }) }])
      expect(execute).not.toHaveBeenCalled()
      expect(out.pause?.questions).toHaveLength(1)
      expect(d.isPaused).toBe(true)
      expect(events.some((e) => e.type === 'ask_user')).toBe(true)
    })
  })

  describe('RunLoop scheduler', () => {
    const config: LoopConfig = { explorationBudget: 2, settlementBudget: 2, emptyRecoveryBudget: 2 }
    // Host giả: mỗi call_round lấy kết quả kế tiếp trong kịch bản; ghi lại các thao tác theo thứ tự
    const scripted = (rounds: Array<Partial<Operations['call_round']['output']>>) => {
      const ops: string[] = []
      const host: LoopHost = {
        async invoke<K extends Operation>(op: K): Promise<Operations[K]['output']> {
          ops.push(op)
          switch (op) {
            case 'call_round':
              return { hasTools: false, hasText: true, truncated: false, reasoningBudgetExhausted: false, ...rounds.shift() } as never
            case 'prepare_recovery':
              return { available: false, rejected: false } as never
            case 'check_finish':
              return { redirect: false, override: false } as never
            case 'dispatch_tools':
              return { pause: false } as never
            case 'after_tools':
              return { override: false, terminate: false } as never
            case 'forced_finish':
              return { extraRounds: 1 } as never
            case 'resolve_pause':
              return false as never
            default:
              return null as never
          }
        }
      }
      return { host, ops }
    }
    const ctrl = () => new AbortController().signal

    it('trả lời ngay khi không cần tool', async () => {
      const { host, ops } = scripted([{}])
      const state = await runLoop(host, config, ctrl())
      expect(state.rounds).toBe(1)
      expect(ops).toEqual(['call_round', 'check_finish', 'finish'])
    })

    it('hết ngân sách thăm dò ⇒ chuyển pha tổng hợp rồi kết thúc', async () => {
      const tools = { hasTools: true, hasText: false }
      const { host, ops } = scripted([tools, tools, {}])
      const state = await runLoop(host, config, ctrl())
      expect(state.exploration_rounds).toBe(2)
      expect(state.settlement_rounds).toBe(1)
      expect(ops).toContain('begin_settlement')
      expect(ops.indexOf('begin_settlement')).toBeGreaterThan(ops.lastIndexOf('after_tools') - 1)
    })

    it('hết cả ngân sách tổng hợp mà vẫn gọi tool ⇒ vòng chốt không tool', async () => {
      const tools = { hasTools: true, hasText: false }
      const { host, ops } = scripted([tools, tools, tools, tools])
      await runLoop(host, config, ctrl())
      expect(ops.at(-1)).toBe('forced_finish')
    })

    it('suy nghĩ ăn hết ngân sách: lần 1 tiếp tục, lần 2 báo lỗi', async () => {
      const spent = { hasText: false, truncated: true, reasoningBudgetExhausted: true }
      const first = scripted([spent, {}])
      const state = await runLoop(first.host, config, ctrl())
      expect(state.reasoning_budget_recoveries).toBe(1)
      expect(first.ops).toContain('continue_truncated')

      const twice = scripted([spent, spent])
      const host: LoopHost = { invoke: (op, args, st) => (op === 'raise_reasoning_budget' ? Promise.reject(new ReasoningBudgetExhausted()) : twice.host.invoke(op, args, st)) }
      await expect(runLoop(host, config, ctrl())).rejects.toBeInstanceOf(ReasoningBudgetExhausted)
    })

    it('rỗng hai lần ⇒ chốt bằng forced_finish', async () => {
      const { host, ops } = scripted([{ hasText: false }, { hasText: false }])
      await runLoop(host, config, ctrl())
      expect(ops.filter((o) => o === 'recover_empty')).toHaveLength(2)
      expect(ops.at(-1)).toBe('forced_finish')
    })

    it('hủy lượt ⇒ dừng ngay', async () => {
      const abort = new AbortController()
      abort.abort()
      await expect(runLoop(scripted([{}]).host, config, abort.signal)).rejects.toThrow()
    })
  })

  describe('N7AgentSession (model giả)', () => {
    const chunk = (delta: Record<string, unknown>, finish_reason: string | null = null, usage?: Record<string, number>) => ({ choices: [{ delta, finish_reason }], ...(usage ? { usage } : {}) })
    type Script = Array<Array<ReturnType<typeof chunk>>>
    const fakeLlm = (script: Script) => {
      const requests: any[] = []
      const llm = {
        chat: async (body: unknown) => {
          requests.push(structuredClone(body))
          const next = script.shift()
          if (!next) throw new Error('no scripted round')
          return (async function* () {
            for (const c of next) yield c
          })()
        }
      } as unknown as LlmService
      return { llm, requests }
    }
    const tool = (id: string, name: string, args = '{}') => chunk({ tool_calls: [{ index: 0, id, function: { name, arguments: args } }] }, 'tool_calls', { prompt_tokens: 10, completion_tokens: 5 })
    const text = (t: string, usage = { prompt_tokens: 20, completion_tokens: 8 }) => [chunk({ content: t }), chunk({}, 'stop', usage)]
    const base = (over: Partial<N7AgentInput> = {}): N7AgentInput => ({
      config: { explorationBudget: 2, settlementBudget: 2, emptyRecoveryBudget: 2 },
      seed: { system: 'sys', history: [], user: { role: 'user', content: 'hỏi' }, outputTokens: 4096 },
      tools: [{ type: 'function', function: { name: 'search', parameters: { type: 'object' } } }],
      execute: async (calls) => calls.map(() => JSON.stringify({ data: [1] })),
      ...over
    })
    const sessionOf = (llm: LlmService, input: N7AgentInput, events: EngineEvent[] = []) => new N7AgentSession(llm, input, (e) => void events.push(e), new AbortController().signal)

    it('tool rồi trả lời: cộng usage mọi vòng, stream chữ ra ngoài', async () => {
      const { llm } = fakeLlm([[tool('c1', 'search', '{"q":"a"}')], text('Xin chào')])
      const events: EngineEvent[] = []
      const r = await sessionOf(llm, base(), events).run()
      expect(r.rounds).toBe(2)
      expect(r.completed).toBe(true)
      expect(r.response).toBe('Xin chào')
      expect(r.usage).toEqual({ prompt_tokens: 30, completion_tokens: 13 })
      expect(events.filter((e) => e.type === 'content').map((e) => e.content).join('')).toBe('Xin chào')
    })

    it('suy nghĩ ăn hết ngân sách ⇒ nhắc "hành động ngay", rồi có câu trả lời', async () => {
      const spent = [chunk({ reasoning_content: 'nghĩ mãi' }), chunk({}, 'length', { prompt_tokens: 10, completion_tokens: 4096 })]
      const { llm, requests } = fakeLlm([spent, text('Đáp án')])
      const r = await sessionOf(llm, base(), []).run()
      expect(r.response).toBe('Đáp án')
      expect(r.reasoning).toBe('nghĩ mãi')
      expect(JSON.stringify(requests[1].messages.at(-1))).toContain('ngân sách đầu ra')
    })

    it('pha tổng hợp: tool_choice=none, max_tokens = ngân sách đầy đủ, có chỉ dẫn chốt', async () => {
      const { llm, requests } = fakeLlm([[tool('c1', 'search')], text('Xong')])
      await sessionOf(llm, base({ config: { explorationBudget: 1, settlementBudget: 2, emptyRecoveryBudget: 2 } })).run()
      expect(requests[0].tool_choice).toBe('auto')
      expect(requests[1].tool_choice).toBe('none')
      expect(requests[1].max_tokens).toBe(4096)
      expect(JSON.stringify(requests[1].messages)).toContain('Đã hết lượt tìm kiếm')
    })

    it('lô tool bị cắt giữa chừng không được chạy', async () => {
      const cut = [chunk({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'search', arguments: '{"q":' } }] }), chunk({}, 'length')]
      const execute = jest.fn(async (calls: ToolCall[]) => calls.map(() => '{}'))
      const { llm } = fakeLlm([cut, text('ổn')])
      const r = await sessionOf(llm, base({ execute })).run()
      expect(execute).not.toHaveBeenCalled()
      expect(r.response).toBe('ổn')
    })

    it('ask_user dừng lượt và trả câu hỏi', async () => {
      const ask = tool('a1', 'ask_user', JSON.stringify({ questions: [{ prompt: 'Chọn hướng?', options: ['A', 'B'] }] }))
      const { llm } = fakeLlm([[ask]])
      const execute = jest.fn(async () => [])
      const r = await sessionOf(llm, base({ execute })).run()
      expect(r.askUser?.questions).toHaveLength(1)
      expect(r.completed).toBe(true)
      expect(r.rounds).toBe(1)
      expect(execute).not.toHaveBeenCalled()
    })

    it('rỗng hai lần ⇒ vòng chốt không tool trả lời được', async () => {
      const empty = [chunk({}, 'stop', { prompt_tokens: 5, completion_tokens: 0 })]
      const { llm, requests } = fakeLlm([empty, empty, text('Chốt')])
      const r = await sessionOf(llm, base()).run()
      expect(r.response).toBe('Chốt')
      expect(requests[2].tool_choice).toBe('none')
    })

    it('danh sách tool đọc lại mỗi vòng (nguồn mở lười lộ thêm công cụ giữa lượt)', async () => {
      const exposed: { type: 'function'; function: { name: string } }[] = [{ type: 'function', function: { name: 'discover' } }]
      const execute = jest.fn(async (calls: ToolCall[]) => {
        exposed.push({ type: 'function', function: { name: 'get_events' } }) // dò danh mục xong ⇒ lộ thêm công cụ
        return calls.map(() => '{}')
      })
      const { llm, requests } = fakeLlm([[tool('c1', 'discover')], text('xong')])
      await sessionOf(llm, base({ tools: () => exposed, execute })).run()
      expect(requests[0].tools.map((t: any) => t.function.name)).toEqual(['discover'])
      expect(requests[1].tools.map((t: any) => t.function.name)).toEqual(['discover', 'get_events'])
    })

    it('pha tổng hợp đóng công cụ: model vẫn gọi tool thì lệnh không chạy', async () => {
      const execute = jest.fn(async (calls: ToolCall[]) => calls.map(() => '{}'))
      const { llm } = fakeLlm([[tool('c1', 'search')], [tool('c2', 'search')], text('chốt')])
      const r = await sessionOf(llm, base({ execute, config: { explorationBudget: 1, settlementBudget: 1, emptyRecoveryBudget: 2 } })).run()
      expect(execute).toHaveBeenCalledTimes(1)
      expect(r.response).toBe('chốt')
    })

    it('tin người dùng gửi thêm được đưa vào vòng kế tiếp', async () => {
      const { llm, requests } = fakeLlm([[tool('c1', 'search')], text('đã tính cả ý mới')])
      const queue = [['À mà thêm điều kiện KKT']]
      await sessionOf(llm, base({ drainInputs: async () => queue.shift() ?? [] })).run()
      expect(JSON.stringify(requests[0].messages)).not.toContain('KKT')
      expect(JSON.stringify(requests[1].messages)).toContain('À mà thêm điều kiện KKT')
    })

    it('lọc <think> inline khỏi câu trả lời', async () => {
      const { llm } = fakeLlm([[chunk({ content: 'Chào <think>suy nghĩ' }), chunk({ content: ' riêng</think> bạn' }), chunk({}, 'stop')]])
      const r = await sessionOf(llm, base()).run()
      expect(r.response).toBe('Chào  bạn')
      expect(r.reasoning).toBe('suy nghĩ riêng')
    })

    it('gateway không trả usage ⇒ ước lượng', async () => {
      const { llm } = fakeLlm([[chunk({ content: 'abc' }), chunk({}, 'stop')]])
      const r = await sessionOf(llm, base()).run()
      expect(r.usage.completion_tokens).toBeGreaterThan(0)
    })
  })

  describe('Capability giải bài', () => {
    it('chặn kết luận khi còn bước chưa xong, cho qua khi đã hoàn thành', () => {
      const cap = solveCapability()
      const run = (name: string, args: unknown) => JSON.parse(cap.tools.find((t) => t.schema.function.name === name)!.run(args as never))
      expect(cap.policy?.checkFinish?.('xong')).toBeNull() // chưa lập kế hoạch ⇒ bài đơn giản, cho qua
      const planned = run('solve_plan', { steps: [{ title: 'Đặt hàm Lagrange' }, { title: 'Giải hệ' }] })
      expect(planned.remaining).toBe(2)
      expect(cap.policy?.checkFinish?.('xong')).toMatch(/2 bước chưa hoàn thành/)
      run('solve_finish_step', { id: 's1', result: 'L = f - λg' })
      run('solve_finish_step', { id: 's2', result: 'x=1' })
      expect(cap.policy?.checkFinish?.('xong')).toBeNull()
    })

    it('chỉ lập lại kế hoạch tối đa 2 lần và giữ bước đã xong', () => {
      const cap = solveCapability()
      const run = (name: string, args: unknown) => JSON.parse(cap.tools.find((t) => t.schema.function.name === name)!.run(args as never))
      run('solve_plan', { steps: ['a', 'b'] })
      run('solve_finish_step', { id: 's1', result: 'ok' })
      const first = run('solve_replan', { reason: 'sai hướng', steps: ['c'] })
      expect(first.steps.map((s: { id: string }) => s.id)).toEqual(['s1', 's2'])
      expect(run('solve_replan', { reason: 'lại', steps: ['d'] }).ok).toBe(true)
      expect(run('solve_replan', { reason: 'nữa', steps: ['e'] }).error).toMatch(/hết số lần/)
    })
  })
})
