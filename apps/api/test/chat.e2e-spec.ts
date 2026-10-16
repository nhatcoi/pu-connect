import { randomUUID } from 'crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Chat (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('DM: mở idempotent, gửi tin, chưa đọc, đánh dấu đã đọc', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const agentA = await loginAgent(app, a)
    const agentB = await loginAgent(app, b)

    const c1 = await agentA.post('/api/conversations/direct').send({ userId: b.id }).expect(200)
    const c2 = await agentB.post('/api/conversations/direct').send({ userId: a.id }).expect(200)
    expect(c2.body.data.id).toBe(c1.body.data.id)
    const convId = c1.body.data.id

    const clientMsgId = randomUUID()
    const sent = await agentA.post(`/api/conversations/${convId}/messages`).send({ clientMsgId, content: 'Chào bạn!' }).expect(201)
    // Retry cùng clientMsgId ⇒ không tạo bản sao
    const again = await agentA.post(`/api/conversations/${convId}/messages`).send({ clientMsgId, content: 'Chào bạn!' }).expect(201)
    expect(again.body.data.id).toBe(sent.body.data.id)

    const unread = await agentB.get('/api/conversations/unread-count').expect(200)
    expect(unread.body.data.total).toBe(1)

    const list = await agentB.get(`/api/conversations/${convId}/messages`).expect(200)
    expect(list.body.data.map((m: { content: string }) => m.content)).toEqual(['Chào bạn!'])

    await agentB.post(`/api/conversations/${convId}/read`).send({ messageId: sent.body.data.id }).expect(200)
    const after = await agentB.get('/api/conversations/unread-count').expect(200)
    expect(after.body.data.total).toBe(0)
  })

  it('người ngoài không đọc/gửi được vào hội thoại', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const outsider = await createUser(db)
    const agentA = await loginAgent(app, a)
    const agentX = await loginAgent(app, outsider)
    const conv = await agentA.post('/api/conversations/direct').send({ userId: b.id }).expect(200)
    await agentX.get(`/api/conversations/${conv.body.data.id}/messages`).expect(403)
    await agentX.post(`/api/conversations/${conv.body.data.id}/messages`).send({ content: 'hack' }).expect(403)
  })

  it('nhóm: tạo, thu hồi tin của mình', async () => {
    const owner = await createUser(db)
    const m1 = await createUser(db)
    const m2 = await createUser(db)
    const agent = await loginAgent(app, owner)
    const conv = await agent
      .post('/api/conversations')
      .send({ title: 'Nhóm đồ án', memberIds: [m1.id, m2.id] })
      .expect(201)
    expect(conv.body.data.memberCount).toBe(3)

    const msg = await agent.post(`/api/conversations/${conv.body.data.id}/messages`).send({ content: 'Họp lúc 8h' }).expect(201)
    const del = await agent.delete(`/api/messages/${msg.body.data.id}`).expect(200)
    expect(del.body.data).toMatchObject({ deleted: true, content: '' })
  })

  it('hội thoại PU AI: khi chưa cấu hình key, bot trả lời thông báo', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const conv = await agent.post('/api/conversations/ai').expect(200)
    expect(conv.body.data.type).toBe('ai')
    await agent.post(`/api/conversations/${conv.body.data.id}/messages`).send({ content: 'Đệ quy là gì?' }).expect(201)

    // Bot trả lời nền ⇒ chờ tối đa ~3s
    let botReply: { kind: string; status: string } | undefined
    for (let i = 0; i < 30 && !botReply; i++) {
      await new Promise((r) => setTimeout(r, 100))
      const res = await agent.get(`/api/conversations/${conv.body.data.id}/messages`)
      botReply = res.body.data.find((m: { kind: string; status: string }) => m.kind === 'ai' && m.status !== 'streaming')
    }
    expect(botReply).toMatchObject({ kind: 'ai', status: 'error' })
  })

  it('danh sách hội thoại: phân trang keyset, mới nhất trước, lọc chưa đọc ở server', async () => {
    const me = await createUser(db)
    const agent = await loginAgent(app, me)
    const others = await Promise.all(Array.from({ length: 5 }, () => createUser(db)))
    const ids: string[] = []
    for (const o of others) {
      const conv = await agent.post('/api/conversations/direct').send({ userId: o.id }).expect(200)
      ids.push(conv.body.data.id)
      await agent.post(`/api/conversations/${conv.body.data.id}/messages`).send({ content: 'hi' }).expect(201)
    }

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const qs: string = cursor ? `&cursor=${cursor}` : ''
      const page = await agent.get(`/api/conversations?limit=2${qs}`).expect(200)
      expect(page.body.data.data.length).toBeLessThanOrEqual(2)
      seen.push(...page.body.data.data.map((c: { id: string }) => c.id))
      cursor = page.body.data.nextCursor
    } while (cursor)
    expect(seen).toEqual([...ids].reverse()) // tin mới nhất trước, không trùng/sót

    // Người kia nhắn ⇒ chỉ hội thoại đó ở bộ lọc "chưa đọc"
    const other = await loginAgent(app, others[1])
    await other.post(`/api/conversations/${ids[1]}/messages`).send({ content: 'chào' }).expect(201)
    const unread = await agent.get('/api/conversations?filter=unread').expect(200)
    expect(unread.body.data.data.map((c: { id: string }) => c.id)).toEqual([ids[1]])

    await agent.get('/api/conversations?cursor=abc').expect(400)
    await agent.get('/api/conversations?filter=xyz').expect(400)
  })
})
