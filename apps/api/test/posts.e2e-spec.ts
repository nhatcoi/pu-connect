import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Posts & accepted solution (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('tạo bài viết cần đăng nhập', async () => {
    await request(app.getHttpServer()).post('/api/posts').send({ content: 'Xin chào' }).expect(401)
  })

  it('tạo bài Q&A, bình luận và duyệt lời giải', async () => {
    const author = await createUser(db)
    const answerer = await createUser(db)
    const authorAgent = await loginAgent(app, author)
    const answererAgent = await loginAgent(app, answerer)

    const post = await authorAgent
      .post('/api/posts')
      .send({ title: 'Hỏi về đệ quy', content: 'Đệ quy đuôi là gì?', postType: 'qa' })
      .expect(201)
    const postId = post.body.data.id
    expect(postId).toBeTruthy()

    const c1 = await answererAgent.post(`/api/posts/${postId}/comments`).send({ content: 'Câu trả lời 1' }).expect(201)
    const c2 = await answererAgent.post(`/api/posts/${postId}/comments`).send({ content: 'Câu trả lời 2' }).expect(201)
    const c1Id = c1.body.data.id
    const c2Id = c2.body.data.id

    const counts = await db.query(`SELECT comments_count FROM posts WHERE id = $1`, [postId])
    expect(counts.rows[0].comments_count).toBe(2)

    // Người không phải tác giả bài ⇒ không được duyệt
    await answererAgent.post(`/api/comments/${c1Id}/accept-solution`).expect(401)

    const accept1 = await authorAgent.post(`/api/comments/${c1Id}/accept-solution`).expect(201)
    expect(accept1.body.data.isSolution).toBe(true)

    // Duyệt lời giải khác ⇒ lời giải cũ bị bỏ (chỉ 1 lời giải / bài)
    await authorAgent.post(`/api/comments/${c2Id}/accept-solution`).expect(201)
    const sol = await db.query(`SELECT id FROM comments WHERE post_id = $1 AND is_solution`, [postId])
    expect(sol.rows.map((r) => r.id)).toEqual([c2Id])
    const resolved = await db.query(`SELECT is_resolved FROM posts WHERE id = $1`, [postId])
    expect(resolved.rows[0].is_resolved).toBe(true)

    // Bấm lại ⇒ hủy duyệt, bài về chưa giải quyết
    const undo = await authorAgent.post(`/api/comments/${c2Id}/accept-solution`).expect(201)
    expect(undo.body.data.isSolution).toBe(false)
    const after = await db.query(`SELECT is_resolved FROM posts WHERE id = $1`, [postId])
    expect(after.rows[0].is_resolved).toBe(false)
  })

  it('@puai trong bình luận ⇒ PU AI trả lời thành bình luận con', async () => {
    const author = await createUser(db)
    const agent = await loginAgent(app, author)
    const post = await agent.post('/api/posts').send({ content: 'Đệ quy là gì?' }).expect(201)
    const postId = post.body.data.id
    const asked = await agent.post(`/api/posts/${postId}/comments`).send({ content: '@puai giải thích giúp mình' }).expect(201)

    // Trả lời chạy nền ⇒ chờ tối đa 3s
    let rows: { content: string }[] = []
    for (let i = 0; i < 30 && !rows.length; i++) {
      await new Promise((r) => setTimeout(r, 100))
      rows = (
        await db.query(
          `SELECT c.content FROM comments c JOIN users u ON u.id = c.author_id
           WHERE c.post_id = $1 AND c.parent_id = $2 AND u.username = 'puai'`,
          [postId, asked.body.data.id]
        )
      ).rows
    }
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toContain('PU AI')

    // Bình luận thường không gọi PU AI
    await agent.post(`/api/posts/${postId}/comments`).send({ content: 'cảm ơn' }).expect(201)
    await new Promise((r) => setTimeout(r, 300))
    const count = await db.query(`SELECT comments_count FROM posts WHERE id = $1`, [postId])
    expect(count.rows[0].comments_count).toBe(3)
  })
})
