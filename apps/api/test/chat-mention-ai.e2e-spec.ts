import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { TokenCipher } from '../src/modules/ai/connectors/token-cipher'
import { createTestApp, createUser, loginAgent } from './helpers'

// Mention trong nhóm, PU AI nhiều thread, skill, ngữ cảnh (docs/core/09-chat-mention-ai-threads-skills.md)
describe('Chat mention · AI threads · skills · refs (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const summary = async (agent: Awaited<ReturnType<typeof loginAgent>>, id: string) => (await agent.get(`/api/conversations/${id}`).expect(200)).body.data

  it('nhóm: @tên ghi mention + badge, @all chỉ trưởng nhóm, sửa tin bỏ @ thì hết badge', async () => {
    const owner = await createUser(db)
    const m1 = await createUser(db)
    const m2 = await createUser(db)
    const outsider = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const m1Agent = await loginAgent(app, m1)
    const m2Agent = await loginAgent(app, m2)
    const conv = (
      await ownerAgent
        .post('/api/conversations')
        .send({ title: 'Nhóm OOP', memberIds: [m1.id, m2.id] })
        .expect(201)
    ).body.data

    // Người ngoài nhóm không được ghi mention
    const sent = await ownerAgent
      .post(`/api/conversations/${conv.id}/messages`)
      .send({ content: `@${m1.username} xem slide nhé, @${outsider.username}` })
      .expect(201)
    expect(sent.body.data.meta.mentions).toEqual([{ id: m1.id, username: m1.username }])
    expect((await summary(m1Agent, conv.id)).unreadMentions).toBe(1)
    expect((await summary(m2Agent, conv.id)).unreadMentions).toBe(0)
    const ids = await m1Agent.get(`/api/conversations/${conv.id}/mentions`).expect(200)
    expect(ids.body.data).toEqual([sent.body.data.id])

    // Thành viên thường gõ @all ⇒ không nhắc ai; trưởng nhóm ⇒ nhắc cả nhóm
    const notOwner = await m1Agent.post(`/api/conversations/${conv.id}/messages`).send({ content: '@all họp gấp' }).expect(201)
    expect(notOwner.body.data.meta).toBeNull()
    await ownerAgent.post(`/api/conversations/${conv.id}/messages`).send({ content: '@all họp lúc 8h' }).expect(201)
    expect((await summary(m2Agent, conv.id)).unreadMentions).toBe(1)

    // Sửa bỏ @ ⇒ mention biến mất
    const edited = await ownerAgent.patch(`/api/messages/${sent.body.data.id}`).send({ content: 'xem slide nhé' }).expect(200)
    expect(edited.body.data.meta?.mentions).toBeUndefined()
    expect((await summary(m1Agent, conv.id)).unreadMentions).toBe(1) // còn @all

    // Đọc ⇒ hết badge
    const latest = (await m1Agent.get(`/api/conversations/${conv.id}/messages`).expect(200)).body.data[0]
    await m1Agent.post(`/api/conversations/${conv.id}/read`).send({ messageId: latest.id }).expect(200)
    expect((await summary(m1Agent, conv.id)).unreadMentions).toBe(0)
  })

  it('PU AI nhiều thread: tự đặt tiêu đề, chat mới dùng lại thread rỗng, danh sách / tìm / đổi tên / xóa', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const first = (await agent.post('/api/conversations/ai').expect(200)).body.data
    await agent.post(`/api/conversations/${first.id}/messages`).send({ content: 'Giải thích đệ quy\nví dụ giai thừa' }).expect(201)

    const fresh = (await agent.post('/api/ai/threads').expect(200)).body.data
    expect(fresh.id).not.toBe(first.id)
    expect((await agent.post('/api/ai/threads').expect(200)).body.data.id).toBe(fresh.id) // thread rỗng được dùng lại

    // Thread rỗng không nằm trong lịch sử; danh sách chính chỉ 1 PU AI (thread có tin)
    const list = await agent.get('/api/ai/threads').expect(200)
    expect(list.body.data.data).toEqual([expect.objectContaining({ id: first.id, title: 'Giải thích đệ quy' })])
    const main = await agent.get('/api/conversations').expect(200)
    expect(main.body.data.data.filter((c: { type: string }) => c.type === 'ai').map((c: { id: string }) => c.id)).toEqual([first.id])

    expect((await agent.get(`/api/ai/threads?q=${encodeURIComponent('de quy')}`).expect(200)).body.data.data).toHaveLength(1)
    expect((await agent.get('/api/ai/threads?q=khong-co').expect(200)).body.data.data).toHaveLength(0)
    // Tìm theo nội dung tin (không có trong tiêu đề)
    expect((await agent.get(`/api/ai/threads?q=${encodeURIComponent('giai thua')}`).expect(200)).body.data.data).toHaveLength(1)

    await agent.patch(`/api/ai/threads/${first.id}`).send({ title: 'Đệ quy cơ bản' }).expect(200)
    await agent.delete(`/api/ai/threads/${first.id}`).expect(200)
    await agent.get(`/api/conversations/${first.id}`).expect(404)

    // Người khác không xóa được
    const other = await loginAgent(app, await createUser(db))
    await other.delete(`/api/ai/threads/${fresh.id}`).expect(404)
  })

  it('skill: CRUD, list không lộ chỉ dẫn, gắn vào tin; skill của người khác bị từ chối', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const body = { slug: 'Giai-Bai', name: 'Giải bài tập', description: 'Gợi ý từng bước', instructions: 'Chỉ gợi ý hướng làm, không đưa đáp án cuối.' }
    const created = (await agent.post('/api/ai/skills').send(body).expect(201)).body.data
    expect(created.slug).toBe('giai-bai')
    await agent.post('/api/ai/skills').send(body).expect(409)

    const list = (await agent.get('/api/ai/skills').expect(200)).body.data
    expect(list[0]).not.toHaveProperty('instructions')
    expect((await agent.get(`/api/ai/skills/${created.id}`).expect(200)).body.data.instructions).toBe(body.instructions)

    const conv = (await agent.post('/api/conversations/ai').expect(200)).body.data
    const msg = await agent.post(`/api/conversations/${conv.id}/messages`).send({ content: 'Bài 3 chương 2', skillId: created.id }).expect(201)
    expect(msg.body.data.meta.skill).toEqual({ id: created.id, slug: 'giai-bai', name: 'Giải bài tập' })

    const stranger = await loginAgent(app, await createUser(db))
    const conv2 = (await stranger.post('/api/conversations/ai').expect(200)).body.data
    await stranger.post(`/api/conversations/${conv2.id}/messages`).send({ content: 'x', skillId: created.id }).expect(400)
    await stranger.delete(`/api/ai/skills/${created.id}`).expect(404)

    // Chưa công khai ⇒ không có trong thư viện, không cài được
    await stranger.post(`/api/ai/skills/${created.id}/install`).expect(404)
    await agent
      .patch(`/api/ai/skills/${created.id}`)
      .send({ ...body, isPublic: true })
      .expect(200)
    const lib = (await stranger.get(`/api/ai/skills/library?q=${encodeURIComponent('goi y')}`).expect(200)).body.data
    expect(lib).toEqual([expect.objectContaining({ id: created.id, installed: false, installCount: 0 })])
    expect((await agent.get('/api/ai/skills/library').expect(200)).body.data.some((s: { id: string }) => s.id === created.id)).toBe(false)

    // Cài = bản sao độc lập; lệnh trùng ⇒ hậu tố; cài lần 2 ⇒ 409
    await stranger
      .post('/api/ai/skills')
      .send({ ...body, name: 'Của tôi' })
      .expect(201)
    const installed = (await stranger.post(`/api/ai/skills/${created.id}/install`).expect(201)).body.data
    expect(installed).toMatchObject({ slug: 'giai-bai-2', name: 'Giải bài tập', isPublic: false, instructions: body.instructions })
    await stranger.post(`/api/ai/skills/${created.id}/install`).expect(409)
    expect((await stranger.get('/api/ai/skills/library').expect(200)).body.data[0]).toMatchObject({ installed: true, installCount: 1 })
  })

  it('ngữ cảnh: gợi ý, gắn học phần; tài liệu riêng của người khác & thread trong nhóm bị từ chối', async () => {
    const user = await createUser(db)
    const other = await createUser(db)
    const agent = await loginAgent(app, user)
    const code = `T${Date.now().toString().slice(-6)}`
    const course = await db.query(`INSERT INTO courses (code, name, credits) VALUES ($1, 'Cấu trúc dữ liệu kiểm thử', 3) RETURNING id`, [code])
    const doc = await db.query(
      `INSERT INTO documents (owner_id, title, file_url, visibility) VALUES ($1, 'Đề riêng tư', 'https://x/y.pdf', 'private') RETURNING id`,
      [other.id]
    )

    const suggest = await agent.get(`/api/chat/refs?q=${encodeURIComponent('cau truc du lieu kiem')}&types=course`).expect(200)
    expect(suggest.body.data).toEqual([expect.objectContaining({ type: 'course', id: course.rows[0].id, code })])

    const conv = (await agent.post('/api/conversations/ai').expect(200)).body.data
    const msg = await agent
      .post(`/api/conversations/${conv.id}/messages`)
      .send({ content: 'Ôn môn này', refs: [{ type: 'course', id: course.rows[0].id }] })
      .expect(201)
    expect(msg.body.data.meta.refs).toEqual([{ type: 'course', id: course.rows[0].id, title: 'Cấu trúc dữ liệu kiểm thử', code }])

    await agent
      .post(`/api/conversations/${conv.id}/messages`)
      .send({ content: 'x', refs: [{ type: 'document', id: doc.rows[0].id }] })
      .expect(400)

    const group = (
      await agent
        .post('/api/conversations')
        .send({ title: 'G', memberIds: [other.id] })
        .expect(201)
    ).body.data
    await agent
      .post(`/api/conversations/${group.id}/messages`)
      .send({ content: 'x', refs: [{ type: 'thread', id: conv.id }] })
      .expect(400)
  })

  it('connector: danh sách kèm trạng thái kết nối; Google Drive ngắt kết nối idempotent; token mã hóa', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const list = (await agent.get('/api/ai/connectors').expect(200)).body.data
    expect(list.map((c: { id: string }) => c.id)).toEqual(['library', 'my_documents', 'my_groups', 'google_drive', 'google_calendar'])
    expect(list.find((c: { id: string }) => c.id === 'google_drive')).toMatchObject({ requiresAuth: true, connected: false })
    await agent.delete('/api/ai/connectors/google-drive').expect(200)
    await agent.delete('/api/ai/connectors/dropbox').expect(400)

    // Callback không có state trong session ⇒ không lưu gì, về trang tin nhắn báo lỗi
    const cb = await agent.get('/api/ai/connectors/google/callback?code=x&state=forged').expect(302)
    expect(cb.headers.location).toMatch(/\/messages\?connector=google&result=error$/)

    const cipher = new TokenCipher('secret')
    const enc = cipher.encrypt('refresh-token')
    expect(enc).not.toContain('refresh-token')
    expect(cipher.decrypt(enc)).toBe('refresh-token')
    expect(() => new TokenCipher('other').decrypt(enc)).toThrow()
  })
})
