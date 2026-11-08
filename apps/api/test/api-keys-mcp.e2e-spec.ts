import type { NestExpressApplication } from '@nestjs/platform-express'
import * as request from 'supertest'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// API key + MCP: tạo/thu hồi key, scope, MCP initialize/tools/call
describe('API keys & MCP (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  const MCP_HEADERS = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' }

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    await app.listen(0, '127.0.0.1') // MCP gọi lại REST nội bộ qua loopback
    process.env.PORT = String((app.getHttpServer().address() as { port: number }).port)
  })
  afterAll(async () => {
    await app.close()
  })

  async function newKey(scopes: string[]) {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const res = await agent.post('/api/api-keys').send({ name: 'Claude Desktop', scopes }).expect(201)
    return { user, agent, key: res.body.data.key as string, id: res.body.data.id as string }
  }
  const rpc = (key: string, method: string, params: object = {}, id = 1) =>
    request(app.getHttpServer()).post('/api/mcp').set(MCP_HEADERS).set('Authorization', `Bearer ${key}`).send({ jsonrpc: '2.0', id, method, params })
  const call = (key: string, name: string, args: object) => rpc(key, 'tools/call', { name, arguments: args })

  it('key chỉ hiện 1 lần, danh sách chỉ còn tiền tố; sai key ⇒ 401; không có key ⇒ 401 ở /mcp', async () => {
    const { agent, key } = await newKey(['read'])
    expect(key).toMatch(/^puk_/)
    const list = (await agent.get('/api/api-keys').expect(200)).body.data
    expect(list).toHaveLength(1)
    expect(JSON.stringify(list)).not.toContain(key)
    await request(app.getHttpServer()).get('/api/posts').set('Authorization', 'Bearer puk_sai').expect(401)
    await request(app.getHttpServer()).post('/api/mcp').set(MCP_HEADERS).send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).expect(401)
  })

  it('key không quản lý được key, không đụng tài khoản; thu hồi ⇒ hết hiệu lực', async () => {
    const { agent, key, id } = await newKey(['read', 'write'])
    await request(app.getHttpServer()).get('/api/api-keys').set('Authorization', `Bearer ${key}`).expect(403)
    await request(app.getHttpServer()).patch('/api/users/profile').set('Authorization', `Bearer ${key}`).send({ bio: 'x' }).expect(403)
    await request(app.getHttpServer()).get('/api/notifications/unread-count').set('Authorization', `Bearer ${key}`).expect(200)
    await agent.delete(`/api/api-keys/${id}`).expect(200)
    await request(app.getHttpServer()).get('/api/notifications/unread-count').set('Authorization', `Bearer ${key}`).expect(401)
  })

  it('scope: read không ghi được; write không đụng tài liệu/AI', async () => {
    const ro = await newKey(['read'])
    await request(app.getHttpServer()).post('/api/posts').set('Authorization', `Bearer ${ro.key}`).send({ content: 'x' }).expect(403)
    const rw = await newKey(['read', 'write'])
    await request(app.getHttpServer()).post('/api/posts').set('Authorization', `Bearer ${rw.key}`).send({ content: 'Bài qua key' }).expect(201)
    await request(app.getHttpServer()).delete('/api/documents/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${rw.key}`).expect(403)
    await request(app.getHttpServer()).get('/api/ai/notes').set('Authorization', `Bearer ${rw.key}`).expect(403)
  })

  it('MCP: tools/list lọc theo scope; tools/call đăng bài + bình luận + tìm', async () => {
    const ro = await newKey(['read'])
    const names = (r: request.Response) => (r.body.result.tools as { name: string }[]).map((t) => t.name)
    const roTools = names(await rpc(ro.key, 'tools/list').expect(200))
    expect(roTools).toContain('search')
    expect(roTools).not.toContain('create_post')

    const rw = await newKey(['read', 'write', 'documents', 'ai'])
    const all = names(await rpc(rw.key, 'tools/list').expect(200))
    expect(all).toEqual(expect.arrayContaining(['create_post', 'create_comment', 'upload_document', 'create_note', 'ask_community']))

    const created = await call(rw.key, 'create_post', { content: 'Hỏi về giải tích hàm nhiều biến', postType: 'qa' }).expect(200)
    expect(created.body.result.isError).toBeFalsy()
    const postId = JSON.parse(created.body.result.content[0].text).id as string
    const cm = await call(rw.key, 'create_comment', { postId, content: 'Bình luận qua MCP' }).expect(200)
    expect(cm.body.result.isError).toBeFalsy()
    const got = await call(rw.key, 'get_post', { id: postId }).expect(200)
    expect(JSON.parse(got.body.result.content[0].text).commentsCount).toBe(1)

    // tool bị thiếu scope không có ⇒ lỗi tool, không phải lỗi ghi
    const denied = await call(ro.key, 'create_post', { content: 'x' }).expect(200)
    expect(denied.body.error ?? denied.body.result?.isError).toBeTruthy()
  })

  it('MCP: upload_document tải tệp + xuất bản; note CRUD', async () => {
    const { key } = await newKey(['read', 'documents', 'ai'])
    const up = await call(key, 'upload_document', { filename: 'de-cuong.md', text: '# Đề cương\n\nNội dung ôn tập', title: 'Đề cương MCP' }).expect(200)
    expect(up.body.result.isError).toBeFalsy()
    const note = await call(key, 'create_note', { title: 'Ghi chú MCP', content: 'Nội dung' }).expect(200)
    expect(note.body.result.isError).toBeFalsy()
    const noteId = JSON.parse(note.body.result.content[0].text).id as string
    await call(key, 'append_note', { id: noteId, markdown: 'thêm dòng' }).expect(200)
    const read = await call(key, 'get_note', { id: noteId }).expect(200)
    expect(read.body.result.content[0].text).toContain('thêm dòng')
  })
})
