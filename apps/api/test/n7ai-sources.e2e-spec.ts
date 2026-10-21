import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

const PDF = 'application/pdf'

// Tài liệu của cuộc trò chuyện N7AI / thư viện (docs/core/24-n7ai-sources.md)
describe('N7AI sources (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('văn bản dán: thêm vào thread · liệt kê · đọc nội dung · xóa', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const threadId = (await agent.post('/api/ai/threads').expect(200)).body.data.id

    const added = (await agent.post('/api/ai/sources').send({ type: 'text', threadId, content: 'Định lý Pythagoras: a² + b² = c²\nVí dụ…' }).expect(201)).body.data
    expect(added).toMatchObject({ kind: 'text', threadId, title: 'Định lý Pythagoras: a² + b² = c²', attachment: null })

    const listed = (await agent.get(`/api/ai/sources?threadId=${threadId}`).expect(200)).body.data
    expect(listed.map((s: { id: string }) => s.id)).toEqual([added.id])
    expect((await agent.get('/api/ai/sources').expect(200)).body.data).toEqual([]) // thư viện riêng, không lẫn

    expect((await agent.get(`/api/ai/sources/${added.id}/content`).expect(200)).body.data.content).toContain('Pythagoras')
    await agent.delete(`/api/ai/sources/${added.id}`).expect(200)
    await agent.delete(`/api/ai/sources/${added.id}`).expect(404)
  })

  it('kiểm tra dữ liệu: nội dung rỗng · liên kết sai · tệp không phải của mình · định dạng không đọc được', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const mine = `chat/${user.id}/1_abc_bai.pdf`

    await agent.post('/api/ai/sources').send({ type: 'text', content: '   ' }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'link', url: 'không phải url' }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'link', url: 'http://127.0.0.1/secret' }).expect(422) // chặn địa chỉ nội bộ (SSRF)
    await agent.post('/api/ai/sources').send({ type: 'file', file: { key: 'chat/someone-else/x.pdf', name: 'x.pdf', size: 10, mime: PDF } }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'file', file: { key: `chat/${user.id}/../x.pdf`, name: 'x.pdf', size: 10, mime: PDF } }).expect(400)
    await agent.post('/api/ai/sources').send({ type: 'file', file: { key: `chat/${user.id}/1_abc_nen.zip`, name: 'nen.zip', size: 10, mime: 'application/zip' } }).expect(400)

    const file = (await agent.post('/api/ai/sources').send({ type: 'file', file: { key: mine, name: 'bai.pdf', size: 10, mime: PDF } }).expect(201)).body.data
    expect(file).toMatchObject({ kind: 'file', threadId: null, attachment: { key: mine, name: 'bai.pdf', mime: PDF } })
    const again = (await agent.post('/api/ai/sources').send({ type: 'file', file: { key: mine, name: 'bai.pdf', size: 10, mime: PDF } }).expect(201)).body.data
    expect(again.id).toBe(file.id) // thêm lại cùng tệp ⇒ không trùng
  })

  it('thêm tài liệu thư viện vào thread (copy) · giới hạn số lượng · không dùng của người khác', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)
    const threadId = (await ownerAgent.post('/api/ai/threads').expect(200)).body.data.id
    const library = (await ownerAgent.post('/api/ai/sources').send({ type: 'text', title: 'Ghi chú', content: 'Nội dung ghi chú' }).expect(201)).body.data

    const copied = (await ownerAgent.post('/api/ai/sources').send({ type: 'copy', threadId, sourceId: library.id }).expect(201)).body.data
    expect(copied).toMatchObject({ threadId, kind: 'text', title: 'Ghi chú' })
    expect(copied.id).not.toBe(library.id)

    await otherAgent.post('/api/ai/sources').send({ type: 'copy', threadId, sourceId: library.id }).expect(404) // thread không phải của mình
    await otherAgent.get(`/api/ai/sources?threadId=${threadId}`).expect(404)
    await otherAgent.delete(`/api/ai/sources/${copied.id}`).expect(404)
    await otherAgent.get(`/api/ai/sources/${copied.id}/content`).expect(404)

    for (let i = 1; i < 30; i++) await ownerAgent.post('/api/ai/sources').send({ type: 'text', threadId, title: `t${i}`, content: `nội dung ${i}` }).expect(201)
    await ownerAgent.post('/api/ai/sources').send({ type: 'text', threadId, content: 'quá giới hạn' }).expect(400)
  })
})
