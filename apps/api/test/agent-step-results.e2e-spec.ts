import type { AiRunTimings, AiStep } from '@pu/schemas'
import { AgentToolRunner, countResults } from '../src/modules/ai/agent-tool-runner'
import type { AgentToolSession } from '../src/modules/ai/agent-tools'
import { AcademicSearchUnavailableError, SemanticScholarService } from '../src/modules/ai/connectors/semantic-scholar.service'

// Bước công cụ ghi số kết quả ⇒ giao diện hiện "3 kết quả" / "không có kết quả" (mờ) và đếm nguồn đúng (docs/core/16 §11)
describe('Agent step result counts', () => {
  it('đếm: mảng, object nhiều nhóm, bỏ qua dữ liệu không phải danh sách', () => {
    expect(countResults([1, 2, 3])).toBe(3)
    expect(countResults({ documents: [1], posts: [1, 2], guidance: 'x', courses: undefined })).toBe(3)
    expect(countResults({ title: 'một hội thoại', messages: 'x' })).toBeUndefined()
    expect(countResults('cắt ngắn')).toBeUndefined()
  })

  it('runner gắn resultCount cho bước tìm thành công (kể cả 0), không gắn khi lỗi', async () => {
    const results: Record<string, string> = {
      found: JSON.stringify({ provider: 'x', data: [{ id: 1 }, { id: 2 }] }),
      empty: JSON.stringify({ provider: 'x', data: [] }),
      broken: JSON.stringify({ error: 'down' })
    }
    const session: AgentToolSession = {
      tools: [],
      instructions: [],
      readOnly: () => true,
      describe: (name) => ({ provider: 'library', label: name }),
      call: (name) => Promise.resolve(results[name]),
      close: () => Promise.resolve()
    }
    let steps: AiStep[] = []
    const timings: AiRunTimings = { modelWaitMs: 0, modelStreamMs: 0, toolWallMs: 0, mcpOpenMs: 0, rounds: 0, toolCalls: 0, cacheHits: 0 }
    const runner = new AgentToolRunner(session, AbortSignal.timeout(5000), 8, timings, (s) => (steps = s))
    await runner.batch(
      ['found', 'empty', 'broken'].map((name) => ({ id: name, name, arguments: '{}' })),
      true
    )
    expect(steps.map((s) => [s.id, s.status, s.resultCount])).toEqual([
      ['found', 'done', 2],
      ['empty', 'done', 0],
      ['broken', 'error', undefined]
    ])
  })

  it('nguồn báo unavailable ⇒ không gọi lại tool đó trong lượt (model hay đổi từ khóa thử lại)', async () => {
    let calls = 0
    const session: AgentToolSession = {
      tools: [],
      instructions: [],
      readOnly: () => true,
      describe: () => ({ provider: 'semantic_scholar', label: 'Tìm bài báo khoa học' }),
      call: () => {
        calls++
        return Promise.resolve(JSON.stringify({ error: 'quá tải', unavailable: true }))
      },
      close: () => Promise.resolve()
    }
    const timings: AiRunTimings = { modelWaitMs: 0, modelStreamMs: 0, toolWallMs: 0, mcpOpenMs: 0, rounds: 0, toolCalls: 0, cacheHits: 0 }
    const runner = new AgentToolRunner(session, AbortSignal.timeout(5000), 8, timings, () => undefined)
    await runner.batch([{ id: 'a', name: 'semantic_scholar__search', arguments: '{"query":"x"}' }], true)
    const [second] = await runner.batch([{ id: 'b', name: 'semantic_scholar__search', arguments: '{"query":"y"}' }], true)
    expect(calls).toBe(1)
    expect(JSON.parse(second).error).toContain('không gọi lại')
  })
})

describe('SemanticScholarService', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })
  const arxivXml = `<feed><entry><id>http://arxiv.org/abs/1</id><title>Federated Learning in Healthcare</title><summary>abc</summary><published>2023-01-01T00:00:00Z</published><author><name>A. B</name></author></entry></feed>`
  const respond = (s2: number, arxiv: number | 'throw') =>
    jest.fn((url: string) => {
      if (url.includes('semanticscholar')) return Promise.resolve(new Response('{}', { status: s2 }))
      if (arxiv === 'throw') return Promise.reject(new Error('timeout'))
      return Promise.resolve(new Response(arxivXml, { status: arxiv }))
    }) as unknown as typeof fetch

  it('S2 429 ⇒ arXiv; cùng từ khóa ⇒ dùng cache', async () => {
    const fetchMock = respond(429, 200)
    global.fetch = fetchMock
    const svc = new SemanticScholarService()
    const first = await svc.search('federated learning healthcare', 3)
    expect(first.map((s) => s.title)).toEqual(['Federated Learning in Healthcare (2023)'])
    await svc.search('Federated learning healthcare', 3)
    expect((fetchMock as unknown as jest.Mock).mock.calls).toHaveLength(2) // S2 + arXiv, lần 2 lấy cache
  })

  it('cả S2 và arXiv lỗi ⇒ ném lỗi "quá tải" (khác với không có bài)', async () => {
    global.fetch = respond(429, 'throw')
    await expect(new SemanticScholarService().search('x y z', 3)).rejects.toBeInstanceOf(AcademicSearchUnavailableError)
  })
})
