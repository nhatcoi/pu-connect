import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Ẩn danh: bài hỏi đáp + bình luận không để lộ tác giả ở bất kỳ phản hồi công khai nào
describe('Anonymous posts & comments (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const waitForNotification = async (recipientId: string, type: string) => {
    for (let i = 0; i < 20; i++) {
      const res = await db.query(`SELECT actor_id, title FROM notifications WHERE recipient_id = $1 AND type = $2`, [recipientId, type])
      if (res.rows.length) return res.rows
      await new Promise((r) => setTimeout(r, 100))
    }
    return []
  }

  it('bài ẩn danh: người khác và feed không thấy tác giả; chủ bài thấy isMine; tab Đang theo dõi không có', async () => {
    const author = await createUser(db)
    const reader = await createUser(db)
    await db.query(`INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)`, [reader.id, author.id])
    const authorAgent = await loginAgent(app, author)
    const readerAgent = await loginAgent(app, reader)

    const created = await authorAgent
      .post('/api/posts')
      .send({ title: 'Hỏi kín', content: 'Thầy chấm điểm thế nào?', postType: 'qa', isAnonymous: true })
      .expect(201)
    expect(created.body.data).toMatchObject({ isAnonymous: true, isMine: true, authorId: 'anonymous', author: { username: 'an-danh', displayName: 'Ẩn danh' } })
    const postId = created.body.data.id as string

    const seen = await readerAgent.get(`/api/posts/${postId}`).expect(200)
    const body = JSON.stringify(seen.body)
    expect(seen.body.data).toMatchObject({ isAnonymous: true, isMine: false, authorId: 'anonymous' })
    for (const secret of [author.id, author.username, author.email]) expect(body).not.toContain(secret)

    const feed = await readerAgent.get('/api/posts?feedType=qa&limit=50').expect(200)
    const inFeed = (feed.body.data as any[]).find((p) => p.id === postId)
    expect(inFeed?.author.username).toBe('an-danh')
    expect(JSON.stringify(feed.body)).not.toContain(author.username)

    const following = await readerAgent.get('/api/posts?feedType=following&limit=50').expect(200)
    expect((following.body.data as any[]).some((p) => p.id === postId)).toBe(false)

    // Người theo dõi không nhận thông báo bài mới
    await new Promise((r) => setTimeout(r, 400))
    const notified = await db.query(`SELECT 1 FROM notifications WHERE recipient_id = $1 AND type = 'followed_post'`, [reader.id])
    expect(notified.rows).toHaveLength(0)

    // Chủ bài vẫn xoá được bài của mình
    await authorAgent.delete(`/api/posts/${postId}`).expect(200)
  })

  it('chỉ bài hỏi đáp công khai, ngoài cộng đồng mới đăng ẩn danh được', async () => {
    const agent = await loginAgent(app, await createUser(db))
    await agent.post('/api/posts').send({ content: 'Chuyện phiếm', postType: 'general', isAnonymous: true }).expect(400)
    await agent.post('/api/posts').send({ content: 'Câu hỏi riêng', postType: 'qa', visibility: 'private', isAnonymous: true }).expect(400)
    await agent.post('/api/posts').send({ content: 'Câu hỏi nhóm', postType: 'qa', communitySlug: 'khong-co', isAnonymous: true }).expect(400)
  })

  it('bình luận ẩn danh: danh sách che tác giả, thông báo cho chủ bài không nêu người gửi', async () => {
    const owner = await createUser(db)
    const commenter = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const commenterAgent = await loginAgent(app, commenter)
    const post = await ownerAgent.post('/api/posts').send({ content: 'Ai biết lịch thi không?', postType: 'qa' }).expect(201)
    const postId = post.body.data.id as string

    const comment = await commenterAgent.post(`/api/posts/${postId}/comments`).send({ content: 'Mình nghe nói tuần sau', isAnonymous: true }).expect(201)
    expect(comment.body.data).toMatchObject({ isAnonymous: true, isMine: true, author: { username: 'an-danh' } })

    const list = await ownerAgent.get(`/api/posts/${postId}/comments`).expect(200)
    const raw = JSON.stringify(list.body)
    expect(raw).toContain('Mình nghe nói tuần sau')
    for (const secret of [commenter.id, commenter.username, commenter.email]) expect(raw).not.toContain(secret)
    expect((list.body.data as any[])[0]).toMatchObject({ isAnonymous: true, isMine: false })

    const [n] = await waitForNotification(owner.id, 'post_comment')
    expect(n.actor_id).toBeNull()
    expect(n.title).toBe('Một người ẩn danh đã bình luận về bài viết của bạn')

    // Không lọt vào hoạt động "đã bình luận" công khai
    const activity = await (await loginAgent(app, owner)).get(`/api/users/${commenter.username}/activity/commented`).expect(200)
    expect(JSON.stringify(activity.body)).not.toContain(postId)
  })

  it('duyệt lời giải của bài ẩn danh: người nhận không biết ai là chủ bài', async () => {
    const owner = await createUser(db)
    const answerer = await createUser(db)
    const ownerAgent = await loginAgent(app, owner)
    const answererAgent = await loginAgent(app, answerer)
    const post = await ownerAgent.post('/api/posts').send({ content: 'Công thức này đúng không?', postType: 'qa', isAnonymous: true }).expect(201)
    const comment = await answererAgent.post(`/api/posts/${post.body.data.id}/comments`).send({ content: 'Đúng rồi bạn' }).expect(201)

    await ownerAgent.post(`/api/comments/${comment.body.data.id}/accept-solution`).expect(201)
    const [n] = await waitForNotification(answerer.id, 'accepted_solution')
    expect(n.actor_id).toBeNull()
    expect(n.title).not.toContain(owner.username)
  })

  it('vượt hạn mức 24h ⇒ 429', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    for (let i = 0; i < 3; i++)
      await agent
        .post('/api/posts')
        .send({ content: `Hỏi ẩn danh ${i}`, postType: 'qa', isAnonymous: true })
        .expect(201)
    await agent.post('/api/posts').send({ content: 'Hỏi ẩn danh thứ tư', postType: 'qa', isAnonymous: true }).expect(429)
    await agent.post('/api/posts').send({ content: 'Hỏi bình thường vẫn được', postType: 'qa' }).expect(201)
  })
})
