import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AiTemporaryEvent } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { AiTemporaryService } from '../src/modules/chat/n7ai/ai-temporary.service'
import { createTestApp, createUser, loginAgent } from './helpers'
import * as request from 'supertest'

// Chat tạm N7AI: stateless, không ghi hội thoại / tin nhắn / bộ nhớ (docs/core/19-n7ai-temporary-chat.md)
describe('N7AI temporary chat (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const fakeService = (quota = { used: 0, limit: 30 }, aiModel = 'n7ai-fast') => {
    const runs: string[] = []
    const prompts: string[] = []
    const models: unknown[] = []
    const llm = {
      client: {},
      quota: () => Promise.resolve(quota),
      logRejected: () => Promise.resolve(),
      startRun: () => Promise.resolve('run-1'),
      finishRun: () => {
        runs.push('done')
        return Promise.resolve()
      },
      failRun: () => {
        runs.push('error')
        return Promise.resolve()
      },
      isBusyError: () => false
    }
    const agent = {
      stream: (messages: { role: string; content: unknown }[], _u: string, _c: unknown, emit: (d: string) => void, _s: unknown, _l: unknown, options: { model?: string }) => {
        models.push(options.model)
        prompts.push(String(messages[0].content), ...messages.slice(1).map((m) => `${m.role}:${String(m.content)}`))
        emit('Xin chào! Mình là N7AI.\n')
        emit('<<<FOLLOWUPS>>>\n- Hỏi tiếp?')
        return Promise.resolve({ finishReason: 'stop', usage: { prompt_tokens: 1, completion_tokens: 1 }, timings: undefined })
      }
    }
    const settings = { get: () => Promise.resolve({ defaultConnectors: ['library'], aiModel }), modelCost: () => Promise.resolve(aiModel === 'n7ai-deep' ? 2 : 1) }
    const tools = { open: () => ({ tools: [], instructions: [], describe: () => null, call: () => Promise.resolve('{}'), close: () => Promise.resolve() }) }
    const service = new AiTemporaryService(llm as never, agent as never, settings as never, tools as never, tools as never)
    return { service, runs, prompts, models }
  }

  it('stream câu trả lời, không có công cụ ghi / bộ nhớ, ghi 1 lượt quota', async () => {
    const { service, runs, prompts } = fakeService()
    const events: AiTemporaryEvent[] = []
    await service.stream('u1', { messages: [{ role: 'user', content: 'xin chào' }] }, (e) => events.push(e))
    expect(events[0]).toEqual({ type: 'delta', text: 'Xin chào! Mình là N7AI.\n' })
    const done = events.find((e) => e.type === 'done')
    expect(done).toMatchObject({ type: 'done', text: 'Xin chào! Mình là N7AI.', followUps: ['Hỏi tiếp?'] })
    expect(runs).toEqual(['done'])
    expect(prompts[0]).toContain('CHAT TẠM')
    expect(prompts[0]).not.toContain('[nhớ]'.repeat(2))
  })

  it('dùng mức model của người dùng; mức sâu tốn 2 lượt', async () => {
    const { service, models } = fakeService({ used: 0, limit: 30 }, 'n7ai-perfect')
    await service.stream('u1', { messages: [{ role: 'user', content: 'hi' }] }, () => undefined)
    expect(models).toEqual(['n7ai-perfect'])
    const deep = fakeService({ used: 29, limit: 30 }, 'n7ai-deep')
    const events: AiTemporaryEvent[] = []
    await deep.service.stream('u1', { messages: [{ role: 'user', content: 'hi' }] }, (e) => events.push(e))
    expect(events).toEqual([{ type: 'error', message: expect.stringContaining('cần 2 lượt') }])
    expect(deep.models).toHaveLength(0)
  })

  it('hết lượt ⇒ sự kiện error, không gọi model', async () => {
    const { service, prompts } = fakeService({ used: 30, limit: 30 })
    const events: AiTemporaryEvent[] = []
    await service.stream('u1', { messages: [{ role: 'user', content: 'hi' }] }, (e) => events.push(e))
    expect(events).toEqual([{ type: 'error', message: expect.stringContaining('hết 30 lượt') }])
    expect(prompts).toHaveLength(0)
  })

  it('HTTP: cần đăng nhập, kiểm tra body, không tạo hội thoại / tin nhắn', async () => {
    await request(app.getHttpServer()).post('/api/ai/temporary/stream').send({ messages: [{ role: 'user', content: 'hi' }] }).expect(401)
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    await agent.post('/api/ai/temporary/stream').send({ messages: [] }).expect(400)
    await agent.post('/api/ai/temporary/stream').send({ messages: [{ role: 'assistant', content: 'x' }] }).expect(400)

    const before = await db.query(`SELECT (SELECT COUNT(*) FROM messages)::int AS m, (SELECT COUNT(*) FROM conversations)::int AS c`)
    const res = await agent.post('/api/ai/temporary/stream').send({ messages: [{ role: 'user', content: 'hi' }] }).expect(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    const after = await db.query(`SELECT (SELECT COUNT(*) FROM messages)::int AS m, (SELECT COUNT(*) FROM conversations)::int AS c`)
    expect(after.rows[0]).toEqual(before.rows[0])
  })
})
