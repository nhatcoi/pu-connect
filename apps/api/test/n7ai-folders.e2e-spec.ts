import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Thư mục lịch sử N7AI (docs/core/23-n7ai-folders.md)
describe('N7AI folders (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  // Thread có tin (danh sách chỉ hiện thread đã có tin)
  async function threadWithMessage(agent: Awaited<ReturnType<typeof loginAgent>>, userId: string): Promise<string> {
    const thread = (await agent.post('/api/ai/threads').expect(200)).body.data
    const msg = await db.query(`INSERT INTO messages (conversation_id, sender_id, kind, content) VALUES ($1, $2, 'text', 'hi') RETURNING id`, [thread.id, userId])
    await db.query(`UPDATE conversations SET last_message_id = $2, last_message_at = NOW() WHERE id = $1`, [thread.id, msg.rows[0].id])
    return thread.id
  }

  it('tạo · chuyển thread vào/ra · lọc theo thư mục · xóa thư mục trả thread về Lịch sử', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const threadId = await threadWithMessage(agent, user.id)

    const folder = (await agent.post('/api/ai/folders').send({ name: '  Giải tích 2 ' }).expect(201)).body.data
    expect(folder).toMatchObject({ name: 'Giải tích 2', threadCount: 0 })
    await agent.post('/api/ai/folders').send({ name: '' }).expect(400)

    const moved = (await agent.patch(`/api/ai/threads/${threadId}/folder`).send({ folderId: folder.id }).expect(200)).body.data
    expect(moved.folderId).toBe(folder.id)
    const ids = async (folderFilter: string) => (await agent.get(`/api/ai/threads?folder=${folderFilter}`).expect(200)).body.data.data.map((t: { id: string }) => t.id)
    expect(await ids(folder.id)).toEqual([threadId])
    expect(await ids('root')).not.toContain(threadId)
    expect(await ids('all')).toContain(threadId)
    expect((await agent.get('/api/ai/folders').expect(200)).body.data[0].threadCount).toBe(1)

    await agent.patch(`/api/ai/folders/${folder.id}`).send({ name: 'Toán' }).expect(200)
    await agent.delete(`/api/ai/folders/${folder.id}`).expect(200)
    expect(await ids('root')).toContain(threadId)
  })

  it('không dùng được thư mục / thread của người khác', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)
    const threadId = await threadWithMessage(ownerAgent, owner.id)
    const foreign = (await otherAgent.post('/api/ai/folders').send({ name: 'Của người khác' }).expect(201)).body.data

    await ownerAgent.patch(`/api/ai/threads/${threadId}/folder`).send({ folderId: foreign.id }).expect(404)
    await otherAgent.patch(`/api/ai/threads/${threadId}/folder`).send({ folderId: null }).expect(404)
    await ownerAgent.patch(`/api/ai/folders/${foreign.id}`).send({ name: 'x' }).expect(404)
    await ownerAgent.delete(`/api/ai/folders/${foreign.id}`).expect(404)
  })
})
