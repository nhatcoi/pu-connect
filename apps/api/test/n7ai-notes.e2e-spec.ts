import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Ghi chú Markdown N7AI: CRUD, cây trang, thêm đoạn, xuất md / docx, cách ly giữa người dùng
describe('N7AI notes (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('tạo · sửa · ghim · thêm đoạn · chuyển trang · xóa trang cha kéo theo trang con', async () => {
    const agent = await loginAgent(app, await createUser(db))
    const parent = (await agent.post('/api/ai/notes').send({ title: ' Giải tích ' }).expect(201)).body.data
    expect(parent).toMatchObject({ title: 'Giải tích', content: '', pinned: false, parentId: null })
    const child = (await agent.post('/api/ai/notes').send({ title: 'Đạo hàm', parentId: parent.id }).expect(201)).body.data
    expect(child.parentId).toBe(parent.id)

    const edited = (await agent.patch(`/api/ai/notes/${parent.id}`).send({ content: '# Xin chào', pinned: true }).expect(200)).body.data
    expect(edited).toMatchObject({ content: '# Xin chào', pinned: true })
    const appended = (await agent.post(`/api/ai/notes/${parent.id}/append`).send({ markdown: 'Đoạn mới' }).expect(201)).body.data
    expect(appended.content).toBe('# Xin chào\n\nĐoạn mới')

    const list = (await agent.get('/api/ai/notes').expect(200)).body.data
    expect(list.map((n: { id: string }) => n.id)[0]).toBe(parent.id) // ghim lên đầu
    expect(list[0]).not.toHaveProperty('content')

    // Không chuyển trang cha vào trang con của nó (vòng lặp cây)
    await agent.patch(`/api/ai/notes/${parent.id}`).send({ parentId: child.id }).expect(400)
    await agent.patch(`/api/ai/notes/${child.id}`).send({ parentId: null }).expect(200)
    await agent.patch(`/api/ai/notes/${child.id}`).send({ parentId: parent.id }).expect(200)

    await agent.delete(`/api/ai/notes/${parent.id}`).expect(200)
    await agent.get(`/api/ai/notes/${child.id}`).expect(404)
  })

  it('xuất Markdown và Word', async () => {
    const agent = await loginAgent(app, await createUser(db))
    const note = (
      await agent
        .post('/api/ai/notes')
        .send({ title: 'Bài 1', content: '# Tiêu đề\n\nChữ **đậm**, *nghiêng*, [liên kết](https://example.com)\n\n- một\n- hai\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```' })
        .expect(201)
    ).body.data
    const md = await agent.get(`/api/ai/notes/${note.id}/export?format=md`).expect(200)
    expect(md.headers['content-disposition']).toContain('.md')
    expect(md.text).toContain('# Bài 1')
    const docx = await agent
      .get(`/api/ai/notes/${note.id}/export?format=docx`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => cb(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(docx.headers['content-disposition']).toContain('.docx')
    expect((docx.body as Buffer).subarray(0, 2).toString()).toBe('PK') // .docx là zip
  })

  it('không đọc / sửa / xóa ghi chú của người khác', async () => {
    const ownerAgent = await loginAgent(app, await createUser(db))
    const otherAgent = await loginAgent(app, await createUser(db))
    const note = (await ownerAgent.post('/api/ai/notes').send({ title: 'Riêng tư' }).expect(201)).body.data
    await otherAgent.get(`/api/ai/notes/${note.id}`).expect(404)
    await otherAgent.patch(`/api/ai/notes/${note.id}`).send({ title: 'x' }).expect(404)
    await otherAgent.get(`/api/ai/notes/${note.id}/export?format=md`).expect(404)
    await otherAgent.delete(`/api/ai/notes/${note.id}`).expect(404)
    await otherAgent.post('/api/ai/notes').send({ parentId: note.id }).expect(404)
    expect((await otherAgent.get('/api/ai/notes').expect(200)).body.data).toEqual([])
  })
})
