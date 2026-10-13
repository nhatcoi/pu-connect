import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Chặn người dùng (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('chặn: khóa DM, ẩn bài & bình luận, không theo dõi; bỏ chặn mở lại', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const agentA = await loginAgent(app, a)
    const agentB = await loginAgent(app, b)

    const conv = await agentA.post('/api/conversations/direct').send({ userId: b.id }).expect(200)
    const convId = conv.body.data.id
    const post = await agentB.post('/api/posts').send({ content: 'Bài của B' }).expect(201)
    await db.query(`INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)`, [a.id, b.id])

    await agentA.put(`/api/blocks/${b.id}`).expect(204)
    await agentA.put(`/api/blocks/${b.id}`).expect(204) // idempotent

    const list = await agentA.get('/api/blocks').expect(200)
    expect(list.body.data.map((u: { id: string }) => u.id)).toEqual([b.id])

    // Hủy theo dõi 2 chiều
    const follows = await db.query(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [a.id, b.id])
    expect(follows.rows).toHaveLength(0)

    // DM: cả hai phía đều không gửi được, không mở DM mới được
    const summaryA = await agentA.get(`/api/conversations/${convId}`).expect(200)
    const summaryB = await agentB.get(`/api/conversations/${convId}`).expect(200)
    expect(summaryA.body.data.blockState).toBe('blocking')
    expect(summaryB.body.data.blockState).toBe('blocked_by')
    await agentB.post(`/api/conversations/${convId}/messages`).send({ content: 'Chào' }).expect(403)
    await agentA.post(`/api/conversations/${convId}/messages`).send({ content: 'Chào' }).expect(403)
    await agentB.post('/api/conversations/direct').send({ userId: a.id }).expect(403)

    // Bảng tin của A không còn bài của B; B không bình luận bài của A được
    const feed = await agentA.get('/api/posts?limit=50').expect(200)
    expect(feed.body.data.map((p: { id: string }) => p.id)).not.toContain(post.body.data.id)
    const postA = await agentA.post('/api/posts').send({ content: 'Bài của A' }).expect(201)
    await agentB.post(`/api/posts/${postA.body.data.id}/comments`).send({ content: 'Hi' }).expect(403)

    // Bỏ chặn ⇒ nhắn tin lại được
    await agentA.delete(`/api/blocks/${b.id}`).expect(204)
    await agentB.post(`/api/conversations/${convId}/messages`).send({ content: 'Chào lại' }).expect(201)
  })

  it('không tự chặn chính mình', async () => {
    const a = await createUser(db)
    const agentA = await loginAgent(app, a)
    await agentA.put(`/api/blocks/${a.id}`).expect(400)
  })
})
