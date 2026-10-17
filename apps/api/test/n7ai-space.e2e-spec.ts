import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Không gian N7AI riêng (docs/core/11-n7ai-space.md): tách khỏi Tin nhắn + Thư viện
describe('N7AI space (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const file = (kind: 'image' | 'file', name: string) => ({ url: `https://cdn.test/${name}`, key: `chat/x/${name}`, name, size: 10, mime: 'x/y', kind })
  // Ghi tin thẳng vào DB (không gọi LLM)
  async function insertMessage(convId: string, senderId: string, values: { kind?: string; content?: string; attachments?: unknown[] }) {
    const res = await db.query(`INSERT INTO messages (conversation_id, sender_id, kind, content, attachments) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
      convId,
      senderId,
      values.kind ?? 'text',
      values.content ?? '',
      values.attachments ? JSON.stringify(values.attachments) : null
    ])
    await db.query(`UPDATE conversations SET last_message_id = $2, last_message_at = NOW() WHERE id = $1`, [convId, res.rows[0].id])
    return String(res.rows[0].id)
  }

  it('Tin nhắn chỉ giữ 1 thread N7AI chat nhanh (gần nhất, đứng đầu); badge không đếm', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const bot = (await db.query(`SELECT id FROM users WHERE username = 'n7ai' AND account_type = 'bot'`)).rows[0].id
    const old = (await agent.post('/api/ai/threads').expect(200)).body.data
    await insertMessage(old.id, bot, { kind: 'ai', content: 'Cũ' })
    const thread = (await agent.post('/api/ai/threads').expect(200)).body.data
    await insertMessage(thread.id, bot, { kind: 'ai', content: 'Xin chào' })

    const list = (await agent.get('/api/conversations').expect(200)).body.data.data
    expect(list.map((c: { id: string }) => c.id)).toEqual([thread.id])
    expect((await agent.post('/api/conversations/ai').expect(200)).body.data.id).toBe(thread.id)
    expect((await agent.get('/api/conversations/unread-count').expect(200)).body.data.total).toBe(0)
    // Mở trực tiếp vẫn được
    expect((await agent.get(`/api/conversations/${thread.id}`).expect(200)).body.data.type).toBe('ai')
  })

  it('Thư viện: ảnh / tệp / học liệu theo loại, chỉ thread của mình, phân trang keyset', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const bot = (await db.query(`SELECT id FROM users WHERE username = 'n7ai' AND account_type = 'bot'`)).rows[0].id
    const a = (await agent.post('/api/ai/threads').expect(200)).body.data
    await insertMessage(a.id, user.id, { content: 'đề bài', attachments: [file('image', 'de1.png'), file('file', 'slide.pdf')] })
    const img2 = await insertMessage(a.id, user.id, { attachments: [file('image', 'de2.png')] })
    await insertMessage(a.id, bot, { kind: 'ai', content: 'Ôn tập:\n```quiz\n{"questions":[]}\n```' })
    await insertMessage(a.id, bot, { kind: 'ai', content: 'Chỉ là chữ' })

    // Thread của người khác không lọt vào
    const other = await loginAgent(app, await createUser(db))
    const b = (await other.post('/api/ai/threads').expect(200)).body.data
    await insertMessage(b.id, bot, { kind: 'ai', content: '```flashcards\n[]\n```' })

    const images = (await agent.get('/api/ai/library?kind=image&limit=1').expect(200)).body.data
    expect(images.data).toEqual([expect.objectContaining({ messageId: img2, threadId: a.id, attachments: [expect.objectContaining({ name: 'de2.png' })] })])
    const next = (await agent.get(`/api/ai/library?kind=image&limit=1&cursor=${images.nextCursor}`).expect(200)).body.data
    // Tin có cả ảnh lẫn tệp ⇒ tab Ảnh chỉ trả ảnh
    expect(next.data[0].attachments.map((f: { name: string }) => f.name)).toEqual(['de1.png'])
    expect(next.nextCursor).toBeNull()

    const files = (await agent.get('/api/ai/library?kind=file').expect(200)).body.data.data
    expect(files.flatMap((i: { attachments: { name: string }[] }) => i.attachments.map((f) => f.name))).toEqual(['slide.pdf'])

    const study = (await agent.get('/api/ai/library?kind=study').expect(200)).body.data.data
    expect(study).toHaveLength(1)
    expect(study[0].content).toContain('```quiz')

    await agent.get('/api/ai/library?kind=video').expect(400)
    await agent.get('/api/ai/library?kind=image&cursor=abc').expect(400)
  })
})
