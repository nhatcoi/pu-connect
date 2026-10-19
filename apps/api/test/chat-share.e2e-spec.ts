import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Chia sẻ bài viết vào chat: DM tự mở, nhóm có sẵn, thẻ xem trước, đếm lượt chia sẻ
describe('Chat share post (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const insertPost = async (authorId: string, opts: { visibility?: string; media?: string[] } = {}) => {
    const res = await db.query(
      `INSERT INTO posts (author_id, title, content, visibility, media_urls) VALUES ($1, 'Đề cương Giải tích', '**Ôn tập** chương 1–3 trước thi', $2, $3) RETURNING id`,
      [authorId, opts.visibility ?? 'public', opts.media ?? []]
    )
    return res.rows[0].id as string
  }

  it('gửi tới người (mở DM) + nhóm, tin mang thẻ bài viết, cộng shares_count', async () => {
    const author = await createUser(db)
    const sharer = await createUser(db)
    const friend = await createUser(db)
    const member = await createUser(db)
    const postId = await insertPost(author.id, { media: ['https://cdn.example.com/a.mp4', 'https://cdn.example.com/b.jpg'] })
    const agent = await loginAgent(app, sharer)
    const group = await agent.post('/api/conversations').send({ title: 'Nhóm ôn thi', memberIds: [member.id] }).expect(201)

    const res = await agent
      .post('/api/chat/share/post')
      .send({ postId, userIds: [friend.id], conversationIds: [group.body.data.id], note: 'Xem cái này nè' })
      .expect(200)
    expect(res.body.data).toMatchObject({ sent: 2, failed: 0 })

    const friendAgent = await loginAgent(app, friend)
    const dm = await friendAgent.post('/api/conversations/direct').send({ userId: sharer.id }).expect(200)
    const msgs = await friendAgent.get(`/api/conversations/${dm.body.data.id}/messages`).expect(200)
    expect(msgs.body.data).toHaveLength(1)
    expect(msgs.body.data[0].content).toBe('Xem cái này nè')
    expect(msgs.body.data[0].meta.sharedPost).toMatchObject({
      id: postId,
      title: 'Đề cương Giải tích',
      excerpt: 'Ôn tập chương 1–3 trước thi',
      image: 'https://cdn.example.com/b.jpg',
      author: { username: author.username }
    })

    const count = await db.query(`SELECT shares_count FROM posts WHERE id = $1`, [postId])
    expect(count.rows[0].shares_count).toBe(2)
  })

  it('bài riêng tư của người khác ⇒ 404; hội thoại không phải của mình bị bỏ qua', async () => {
    const author = await createUser(db)
    const sharer = await createUser(db)
    const stranger = await createUser(db)
    const other = await createUser(db)
    const agent = await loginAgent(app, sharer)

    const privateId = await insertPost(author.id, { visibility: 'private' })
    await agent.post('/api/chat/share/post').send({ postId: privateId, userIds: [stranger.id] }).expect(404)

    // DM của hai người khác: không phải thành viên ⇒ không gửi được nơi nào
    const strangerAgent = await loginAgent(app, stranger)
    const foreign = await strangerAgent.post('/api/conversations/direct').send({ userId: other.id }).expect(200)
    const publicId = await insertPost(author.id)
    await agent.post('/api/chat/share/post').send({ postId: publicId, conversationIds: [foreign.body.data.id] }).expect(400)
    const msgs = await db.query(`SELECT COUNT(*)::int AS n FROM messages WHERE conversation_id = $1`, [foreign.body.data.id])
    expect(msgs.rows[0].n).toBe(0)
  })

  it('không chọn nơi nào ⇒ 400', async () => {
    const sharer = await createUser(db)
    const postId = await insertPost(sharer.id)
    const agent = await loginAgent(app, sharer)
    await agent.post('/api/chat/share/post').send({ postId }).expect(400)
  })
})
