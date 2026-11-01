import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { N7AiService } from '../src/modules/chat/n7ai/n7ai.service'
import { createTestApp, createUser, loginAgent, stubProviders } from './helpers'

type Chunk = Record<string, unknown>
type Create = jest.Mock<Promise<AsyncIterable<Chunk>>, [{ messages: { role: string; content: unknown }[]; tool_choice?: string; max_tokens?: number }]>

// Engine agent trong chat chính: vòng 2 pha, tự phục hồi, ask_user
describe('N7AI engine (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const stream = (chunks: Chunk[]) => (async function* () {
    for (const c of chunks) yield c
  })()
  const stop = (text: string) => [{ choices: [{ delta: { content: text }, finish_reason: 'stop' }] }, { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } }]

  // Hỏi N7AI trong thread riêng với model giả; mỗi phần tử của `rounds` là các chunk của một vòng
  async function ask(rounds: Chunk[][], content = 'Mô tả phương pháp Lagrange', aiMode = 'ask') {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const trigger = (await db.query(`INSERT INTO messages (conversation_id, sender_id, content, meta) VALUES ($1, $2, $3, $4) RETURNING id`, [threadId, user.id, content, JSON.stringify({ aiMode })])).rows[0].id
    const queue = [...rounds]
    const create: Create = jest.fn(async () => stream(queue.shift() ?? stop('hết kịch bản')))
    const restore = stubProviders(app, { chat: { completions: { create } } })
    try {
      await app.get(N7AiService).reply(threadId, user.id, String(trigger))
    } finally {
      restore()
    }
    const reply = (await db.query(`SELECT content, status, meta FROM messages WHERE conversation_id = $1 AND kind = 'ai' ORDER BY created_at DESC LIMIT 1`, [threadId])).rows[0]
    return { create, reply, threadId }
  }

  it('trả lời bình thường và gắn khối suy nghĩ vào meta', async () => {
    const { reply, create } = await ask([[{ choices: [{ delta: { reasoning_content: 'Phân tích bài toán' } }] }, ...stop('Nhân tử Lagrange biến bài toán có ràng buộc thành không ràng buộc.')]])
    expect(reply.status).toBe('done')
    expect(reply.content).toContain('Nhân tử Lagrange')
    expect(reply.meta.reasoning).toBe('Phân tích bài toán')
    const system = String(create.mock.calls[0][0].messages[0].content)
    expect(system).toContain('MỘT vòng lặp')
  })

  it('lỗi gốc: vòng suy nghĩ ăn hết ngân sách rồi trống chữ ⇒ tự nhắc và vẫn ra câu trả lời, không xin lỗi cụt', async () => {
    const spent = [{ choices: [{ delta: { reasoning_content: 'nghĩ mãi không ra' }, finish_reason: 'length' }] }]
    const { reply, create } = await ask([spent, stop('Đây là câu trả lời đầy đủ.')])
    expect(reply.content).toBe('Đây là câu trả lời đầy đủ.')
    expect(reply.content).not.toContain('bị cắt')
    expect(create).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(create.mock.calls[1][0].messages.at(-1))).toContain('ngân sách đầu ra')
  })

  it('ask_user: lưu câu hỏi vào meta.askUser, không ghi câu xin lỗi, không gợi ý tiếp theo', async () => {
    const ask_user = [
      {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, id: 'a1', function: { name: 'ask_user', arguments: JSON.stringify({ questions: [{ prompt: 'Bạn muốn giải theo hướng nào?', options: ['Đại số', 'Hình học'] }] }) } }] },
            finish_reason: 'tool_calls'
          }
        ]
      }
    ]
    const { reply } = await ask([ask_user], 'Giải giúp mình bài này', 'ask_questions')
    expect(reply.status).toBe('done')
    expect(reply.content).toBe('Bạn muốn giải theo hướng nào?')
    expect(reply.meta.askUser.questions[0].options.map((o: { label: string }) => o.label)).toEqual(['Đại số', 'Hình học'])
    expect(reply.meta.followUps).toBeUndefined()
  })
  it('tin gửi thêm khi N7AI đang trả lời được gộp vào lượt đang chạy, không mở lượt song song', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const insert = async (content: string, meta: object) =>
      String((await db.query(`INSERT INTO messages (conversation_id, sender_id, content, meta) VALUES ($1, $2, $3, $4) RETURNING id`, [threadId, user.id, content, JSON.stringify(meta)])).rows[0].id)
    const first = await insert('Giải bài tối ưu có ràng buộc', { aiMode: 'solve' })
    const second = await insert('À mà dùng điều kiện KKT nhé', { aiMode: 'ask' })
    const service = app.get(N7AiService)
    let round = 0
    let injected: unknown
    const create: Create = jest.fn(async () => {
      if (round++ === 0) {
        // Đang ở vòng đầu của lượt 1: người dùng gửi thêm tin thứ hai
        injected = await service.reply(threadId, user.id, second)
        return stream([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'p1', function: { name: 'solve_plan', arguments: JSON.stringify({ steps: ['Lập hàm Lagrange'] }) } }] }, finish_reason: 'tool_calls' }] }])
      }
      if (round === 2) return stream([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'f1', function: { name: 'solve_finish_step', arguments: JSON.stringify({ id: 's1', result: 'L = f - λg' }) } }] }, finish_reason: 'tool_calls' }] }])
      return stream(stop('Đã xét cả điều kiện KKT.'))
    })
    const restore = stubProviders(app, { chat: { completions: { create } } })
    try {
      expect(await service.reply(threadId, user.id, first)).toBe('done')
    } finally {
      restore()
    }
    expect(injected).toBe('skipped')
    expect(create).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(create.mock.calls[1][0].messages)).toContain('À mà dùng điều kiện KKT nhé')
    const aiMessages = (await db.query(`SELECT content FROM messages WHERE conversation_id = $1 AND kind = 'ai'`, [threadId])).rows
    expect(aiMessages).toHaveLength(1)
    expect(aiMessages[0].content).toContain('KKT')
  })
})
