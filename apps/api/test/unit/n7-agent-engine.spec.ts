/**
 * N7AI Agent Engine — Unit Tests
 * Kiểm thử ThinkFilter, Conversation Context, AskUser Tool, và RunLoop Scheduler.
 */
import { ThinkFilter } from '../../src/modules/ai/engine/providers/think-filter'
import { Conversation, estimateText } from '../../src/modules/ai/engine/context/conversation'
import { askPayload, executeAskUser } from '../../src/modules/ai/engine/tools/ask-user'
import { runLoop } from '../../src/modules/ai/engine/core/run-loop'
import type { LoopHost, LoopState, Operation, Operations } from '../../src/modules/ai/engine/core/contracts'

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

  describe('Conversation Context & Estimator', () => {
    it('estimates token count for English and Vietnamese accurately', () => {
      expect(estimateText('hello world')).toBeGreaterThan(0)
      expect(estimateText('Xin chào Phenikaa University')).toBeGreaterThan(5)
    })

    it('projects and snips large tool results when exceeding budget', () => {
      const conv = new Conversation({
        system: 'System prompt',
        history: [],
        user: { role: 'user', content: 'Cần tra cứu' },
        contextWindow: 100 // Giới hạn nhỏ để kích hoạt snip
      })

      conv.beginTools([{ id: 'tool_1', name: 'search' }])
      conv.resolveTool('tool_1', 'Rất dài '.repeat(100))

      const projected = conv.project([])
      expect(projected.messages.length).toBeGreaterThan(0)
    })
  })

  describe('AskUser Tool', () => {
    it('sanitizes and clips questions and options', () => {
      const payload = askPayload({
        question: 'Bạn muốn giải theo hướng nào?',
        options: ['Đại số', 'Hình học', 'Đại số'] // Trùng lặp
      })

      expect(payload.questions).toHaveLength(1)
      expect(payload.questions[0].options).toHaveLength(2) // Đã khử trùng
      expect(payload.questions[0].prompt).toBe('Bạn muốn giải theo hướng nào?')
    })

    it('executes ask_user and returns pause payload', () => {
      const res = executeAskUser({
        questions: [
          {
            prompt: 'Chọn ngôn ngữ lập trình:',
            options: [{ label: 'Python' }, { label: 'C++' }]
          }
        ]
      })

      expect(res.success).toBe(true)
      expect(res.pause).toBeDefined()
    })
  })

  describe('runLoop Scheduler', () => {
    it('transitions from exploration to settlement and finishes cleanly', async () => {
      let callCount = 0
      let settlementCalled = false

      const fakeHost: LoopHost = {
        async invoke<K extends Operation>(op: K, _input: Operations[K]['input'], _state: Readonly<LoopState>): Promise<Operations[K]['output']> {
          if (op === 'begin_settlement') {
            settlementCalled = true
            return null as Operations[K]['output']
          }
          if (op === 'call_round') {
            callCount++
            if (callCount <= 2) {
              // 2 round đầu có tools
              return {
                hasTools: true,
                hasText: false,
                truncated: false,
                reasoningBudgetExhausted: false
              } as Operations[K]['output']
            }
            // Round thứ 3 kết thúc
            return {
              hasTools: false,
              hasText: true,
              truncated: false,
              reasoningBudgetExhausted: false
            } as Operations[K]['output']
          }
          if (op === 'dispatch_tools') {
            return { pause: false } as Operations[K]['output']
          }
          if (op === 'after_tools') {
            return { override: false, terminate: false } as Operations[K]['output']
          }
          if (op === 'check_finish') {
            return { redirect: false, override: false } as Operations[K]['output']
          }
          if (op === 'finish') {
            return null as Operations[K]['output']
          }
          if (op === 'forced_finish') {
            return { extraRounds: 0 } as Operations[K]['output']
          }
          return null as Operations[K]['output']
        }
      }

      const signal = new AbortController().signal
      const finalState = await runLoop(fakeHost, { explorationBudget: 2, settlementBudget: 2, emptyRecoveryBudget: 2 }, signal)

      expect(finalState.rounds).toBe(3)
      expect(settlementCalled).toBe(true)
    })
  })
})

