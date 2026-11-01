import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import OpenAI from 'openai'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { N7AiService } from '../src/modules/chat/n7ai/n7ai.service'
import { createTestApp, createUser, loginAgent, stubProviders } from './helpers'

type Handler = (body: Record<string, any>, res: http.ServerResponse, count: number) => void

// Engine qua DÂY THẬT: SDK OpenAI → HTTP → SSE (đối số tool bị xé vụn, reasoning_content, usage, [DONE], luồng đứt giữa chừng)
describe('N7AI engine over a real OpenAI-compatible wire (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let server: http.Server
  let baseURL: string
  const received: Record<string, any>[] = []
  let handler: Handler = () => undefined

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = JSON.parse(raw || '{}')
        received.push(body)
        handler(body, res, received.length)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
  })
  afterAll(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await app.close()
  })

  const sse = (res: http.ServerResponse, chunks: unknown[]) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) => ({ id: 'x', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: finish }] })

  async function ask(aiMode: string, h: Handler) {
    received.length = 0
    handler = h
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const trigger = (await db.query(`INSERT INTO messages (conversation_id, sender_id, content, meta) VALUES ($1, $2, 'Giải bài Lagrange', $3) RETURNING id`, [threadId, user.id, JSON.stringify({ aiMode })])).rows[0].id
    const restore = stubProviders(app, new OpenAI({ baseURL, apiKey: 'test', maxRetries: 0 }))
    try {
      expect(await app.get(N7AiService).reply(threadId, user.id, String(trigger))).toBe('done')
    } finally {
      restore()
    }
    return (await db.query(`SELECT content, status, meta FROM messages WHERE conversation_id = $1 AND kind = 'ai'`, [threadId])).rows[0]
  }

  it('tool call đối số xé vụn + reasoning_content + answer nhiều mảnh: đúng định dạng yêu cầu ở vòng 2', async () => {
    const reply = await ask('solve', (body, res, n) => {
      if (n === 1) {
        return sse(res, [
          chunk({ reasoning_content: 'Cần lập kế hoạch. ' }),
          chunk({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'solve_plan', arguments: '' } }] }),
          chunk({ tool_calls: [{ index: 0, function: { arguments: '{"steps":["Lập hàm ' } }] }),
          chunk({ tool_calls: [{ index: 0, function: { arguments: 'Lagrange","Giải hệ"]}' } }] }),
          chunk({}, 'tool_calls'),
          { id: 'x', object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 100, completion_tokens: 20 } }
        ])
      }
      if (n === 2) {
        return sse(res, [
          chunk({ tool_calls: [{ index: 0, id: 'call_2', type: 'function', function: { name: 'solve_finish_step', arguments: '{"id":"s1","result":"L=f-λg"}' } }] }),
          chunk({ tool_calls: [{ index: 1, id: 'call_3', type: 'function', function: { name: 'solve_finish_step', arguments: '{"id":"s2","result":"x=1"}' } }] }),
          chunk({}, 'tool_calls')
        ])
      }
      sse(res, [chunk({ content: 'Nghiệm là ' }), chunk({ content: '$x=1$.' }), chunk({}, 'stop'), { id: 'x', object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 150, completion_tokens: 12 } }])
    })

    expect(reply.status).toBe('done')
    expect(reply.content).toBe('Nghiệm là $x=1$.')
    expect(reply.meta.reasoning).toContain('Cần lập kế hoạch')
    expect(received).toHaveLength(3)

    const first = received[0]
    expect(first.stream).toBe(true)
    expect(first.stream_options).toEqual({ include_usage: true })
    expect(first.tool_choice).toBe('auto')
    expect(first.max_tokens).toBeGreaterThan(4000)
    expect(first.tools.map((t: any) => t.function.name)).toEqual(expect.arrayContaining(['solve_plan', 'solve_finish_step', 'solve_replan', 'ask_user']))

    // Vòng 2: assistant mang tool_calls đã ghép đủ đối số JSON, ngay sau là tin tool đúng id
    const round2 = received[1].messages
    const assistant = round2.find((m: any) => m.tool_calls)
    expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual({ steps: ['Lập hàm Lagrange', 'Giải hệ'] })
    const toolMsg = round2[round2.indexOf(assistant) + 1]
    expect(toolMsg).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
    expect(JSON.parse(toolMsg.content).remaining).toBe(2)
    // Vòng 3: hai tool call song song đều có kết quả theo thứ tự
    const round3 = received[2].messages
    const tail = round3.slice(-2)
    expect(tail.map((m: any) => m.tool_call_id)).toEqual(['call_2', 'call_3'])
    expect(tail.every((m: any) => m.role === 'tool')).toBe(true)
  })

  it('luồng SSE đứt trước khi có nội dung ⇒ thử lại đúng một lần và vẫn trả lời', async () => {
    const reply = await ask('ask', (_body, res, n) => {
      if (n === 1) return void res.socket?.destroy()
      sse(res, [chunk({ content: 'Đã thử lại thành công.' }), chunk({}, 'stop')])
    })
    expect(reply.content).toBe('Đã thử lại thành công.')
    expect(received).toHaveLength(2)
  })

  it('model suy nghĩ hết ngân sách (finish_reason=length, chỉ có reasoning) ⇒ vòng sau nhận chỉ dẫn và ra câu trả lời', async () => {
    const reply = await ask('ask', (_body, res, n) =>
      n === 1 ? sse(res, [chunk({ reasoning_content: 'nghĩ rất lâu…' }), chunk({}, 'length')]) : sse(res, [chunk({ content: 'Trả lời đây.' }), chunk({}, 'stop')])
    )
    expect(reply.content).toBe('Trả lời đây.')
    expect(JSON.stringify(received[1].messages.at(-1))).toContain('ngân sách đầu ra')
  })
})
