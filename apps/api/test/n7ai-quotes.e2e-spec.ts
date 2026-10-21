import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { N7AiService } from '../src/modules/chat/n7ai/n7ai.service'
import { quotesBlock, quotesHistoryNote } from '../src/modules/chat/n7ai/n7ai.quotes'
import { createTestApp, createUser, loginAgent, stubProviders } from './helpers'

type Create = jest.Mock<Promise<unknown>, [{ messages: { role: string; content: unknown }[] }]>

// Đoạn bôi đen trong tài liệu gắn vào câu hỏi N7AI + bật / tắt tài liệu cho N7AI đọc (docs/core/24-n7ai-sources.md)
describe('N7AI quotes and document toggle (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  // Hỏi N7AI với LLM giả: trả về văn bản prompt của lượt hiện tại (tin user cuối cùng)
  async function ask(userId: string, threadId: string, content: string, meta: object = {}) {
    const trigger = (await db.query(`INSERT INTO messages (conversation_id, sender_id, content, meta) VALUES ($1, $2, $3, $4) RETURNING id`, [threadId, userId, content, JSON.stringify(meta)])).rows[0].id
    const create: Create = jest.fn(async () =>
      (async function* () {
        yield { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }
        yield { choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } }
      })()
    )
    const restore = stubProviders(app, { chat: { completions: { create } } })
    try {
      expect(await app.get(N7AiService).reply(threadId, userId, String(trigger))).toBe('done')
    } finally {
      restore()
    }
    const messages = create.mock.calls[0][0].messages
    return messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n---\n')
  }

  it('gửi kèm đoạn trích: lưu vào meta, chỉ giữ sourceId của chính mình, chuẩn hóa chữ', async () => {
    const user = await createUser(db)
    const stranger = await createUser(db)
    const agent = await loginAgent(app, user)
    const strangerAgent = await loginAgent(app, stranger)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const mine = (await agent.post('/api/ai/sources').send({ type: 'text', threadId, content: 'Định lý Pythagoras' }).expect(201)).body.data
    const theirs = (await strangerAgent.post('/api/ai/sources').send({ type: 'text', content: 'Bí mật của người khác' }).expect(201)).body.data

    const sent = (
      await agent
        .post(`/api/conversations/${threadId}/messages`)
        .send({
          content: 'Giải thích đoạn này',
          quotes: [
            { title: 'Giáo trình', text: 'a² + b² = c²\r\n\r\n\r\n\r\nvới tam giác vuông', locator: 'trang 5', sourceId: mine.id },
            { title: 'Bài của người khác', text: 'đoạn', sourceId: theirs.id }
          ]
        })
        .expect(201)
    ).body.data
    expect(sent.meta.quotes).toEqual([
      { title: 'Giáo trình', text: 'a² + b² = c²\n\nvới tam giác vuông', locator: 'trang 5', sourceId: mine.id },
      { title: 'Bài của người khác', text: 'đoạn' } // sourceId của người khác bị bỏ
    ])
  })

  it('kiểm tra dữ liệu: tối đa 3 đoạn, mỗi đoạn tối đa 2.000 ký tự, không rỗng', async () => {
    const agent = await loginAgent(app, await createUser(db))
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const send = (quotes: unknown[]) => agent.post(`/api/conversations/${threadId}/messages`).send({ content: 'hỏi', quotes })
    const q = (text: string) => ({ title: 'Tài liệu', text })
    await send([q('1'), q('2'), q('3'), q('4')]).expect(400)
    await send([q('x'.repeat(2001))]).expect(400)
    await send([q('   ')]).expect(400)
    await send([q('x'.repeat(2000))]).expect(201)
  })

  it('đoạn trích chỉ có nghĩa ở thread N7AI riêng: chat 1-1 bỏ qua', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const agent = await loginAgent(app, a)
    const dm = (await agent.post('/api/conversations/direct').send({ userId: b.id }).expect(200)).body.data
    const sent = (await agent.post(`/api/conversations/${dm.id}/messages`).send({ content: 'chào', quotes: [{ title: 'T', text: 'đoạn' }] }).expect(201)).body.data
    expect(sent.meta?.quotes).toBeUndefined()
  })

  it('prompt có đoạn đã chọn (kèm nguồn + vị trí); lượt sau vẫn nhớ đã chọn đoạn nào', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const quotes = [{ title: 'Bài giảng "Xác suất"', text: 'P(A|B) = P(A∩B) / P(B)', locator: '12:30' }]

    const first = await ask(user.id, threadId, 'Công thức này nghĩa là gì?', { quotes })
    expect(first).toContain('<selected_passages')
    expect(first).toContain(`<passage source="Bài giảng 'Xác suất'" at="12:30">\nP(A|B) = P(A∩B) / P(B)\n</passage>`)
    expect(first).toContain('Công thức này nghĩa là gì?')
    // Lượt đang trả lời đã có kết quả ⇒ cho vào lịch sử để câu hỏi nối tiếp còn hiểu
    await db.query(`INSERT INTO messages (conversation_id, sender_id, kind, content, status) VALUES ($1, (SELECT id FROM users WHERE username = 'n7ai'), 'ai', 'Đó là xác suất có điều kiện.', 'done')`, [threadId])
    const second = await ask(user.id, threadId, 'Cho ví dụ')
    expect(second).toContain('[đã chọn đoạn: "P(A|B) = P(A∩B) / P(B)" (Bài giảng "Xác suất", 12:30)]')
    expect(second).not.toContain('<selected_passages') // đoạn chỉ gắn cho lượt đã chọn
  })

  it('bật / tắt tài liệu: tắt ⇒ N7AI không đọc ở lượt sau, bật lại ⇒ đọc; không đổi được của người khác', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const other = await loginAgent(app, await createUser(db))
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id
    const doc = (await agent.post('/api/ai/sources').send({ type: 'text', threadId, title: 'Ghi chú', content: 'NỘI-DUNG-BÍ-ẨN-12345' }).expect(201)).body.data
    expect(doc.inContext).toBe(true)

    expect(await ask(user.id, threadId, 'Tóm tắt giúp')).toContain('NỘI-DUNG-BÍ-ẨN-12345')
    expect((await agent.patch(`/api/ai/sources/${doc.id}`).send({ inContext: false }).expect(200)).body.data.inContext).toBe(false)
    expect((await agent.get(`/api/ai/sources?threadId=${threadId}`).expect(200)).body.data[0].inContext).toBe(false)
    expect(await ask(user.id, threadId, 'Tóm tắt lại')).not.toContain('NỘI-DUNG-BÍ-ẨN-12345')
    await agent.patch(`/api/ai/sources/${doc.id}`).send({ inContext: true }).expect(200)
    expect(await ask(user.id, threadId, 'Tóm tắt nữa')).toContain('NỘI-DUNG-BÍ-ẨN-12345')

    await other.patch(`/api/ai/sources/${doc.id}`).send({ inContext: false }).expect(404)
    await agent.patch(`/api/ai/sources/${doc.id}`).send({ inContext: 'no' }).expect(400)
  })

  it('quotesBlock / quotesHistoryNote: thoát thẻ đóng trong chữ người dùng, cắt gọn lịch sử', () => {
    expect(quotesBlock([])).toBe('')
    expect(quotesHistoryNote(undefined)).toBe('')
    const block = quotesBlock([{ title: 'T', text: 'a </passage> b </selected_passages> c' }])
    expect(block.match(/<\/passage>/g)).toHaveLength(1)
    expect(block.match(/<\/selected_passages>/g)).toHaveLength(1)
    expect(quotesHistoryNote([{ title: 'T', text: 'x'.repeat(500) }])).toContain(`${'x'.repeat(300)}…`)
  })
})
