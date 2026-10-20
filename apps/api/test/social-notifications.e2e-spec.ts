import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

type Agent = Awaited<ReturnType<typeof loginAgent>>
type Item = { type: string; title: string; link: string | null; actorsCount: number }

// Thông báo social mở rộng: thích bình luận, bài mới từ người theo dõi, thành viên mới vào nhóm học (docs/core/05-notifications-and-realtime.md)
describe('Social notifications (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  // Thông báo tạo nền sau khi trả lời request ⇒ đợi tới khi có (hoặc hết giờ)
  async function waitFor(agent: Agent, type: string, count = 1): Promise<Item[]> {
    for (let i = 0; i < 30; i++) {
      const res = await agent.get('/api/notifications?limit=50')
      const list = (res.body.data as Item[]).filter((n) => n.type === type)
      if (list.length >= count) return list
      await new Promise((r) => setTimeout(r, 100))
    }
    return []
  }
  const none = async (agent: Agent, type: string) => {
    await new Promise((r) => setTimeout(r, 400))
    return ((await agent.get('/api/notifications?limit=50')).body.data as Item[]).filter((n) => n.type === type)
  }

  it('thích bình luận: báo tác giả, gộp theo bình luận, bỏ thích / tự thích thì không báo', async () => {
    const author = await createUser(db)
    const fanA = await createUser(db)
    const fanB = await createUser(db)
    const authorAgent = await loginAgent(app, author)
    const post = await authorAgent.post('/api/posts').send({ content: 'Bài hỏi về đệ quy' }).expect(201)
    const comment = await (await loginAgent(app, fanA)).post(`/api/posts/${post.body.data.id}/comments`).send({ content: 'Dùng stack nhé' }).expect(201)
    const commenter = await loginAgent(app, fanA)
    const likeA = await loginAgent(app, fanB)

    await commenter.post(`/api/comments/${comment.body.data.id}/like`).expect(201) // tự thích ⇒ không báo
    expect(await none(commenter, 'comment_like')).toHaveLength(0)

    await likeA.post(`/api/comments/${comment.body.data.id}/like`).expect(201)
    const [n] = await waitFor(commenter, 'comment_like')
    expect(n.link).toBe(`/post/${post.body.data.id}?comment=${comment.body.data.id}`)
    expect(n.actorsCount).toBe(1)

    const third = await loginAgent(app, await createUser(db))
    await third.post(`/api/comments/${comment.body.data.id}/like`).expect(201)
    for (let i = 0; i < 30 && (await commenter.get('/api/notifications')).body.data.find((x: Item) => x.type === 'comment_like')?.actorsCount !== 2; i++)
      await new Promise((r) => setTimeout(r, 100))
    const grouped = (await commenter.get('/api/notifications')).body.data.filter((x: Item) => x.type === 'comment_like')
    expect(grouped).toHaveLength(1)
    expect(grouped[0].actorsCount).toBe(2)

    await likeA.post(`/api/comments/${comment.body.data.id}/like`).expect(201) // bỏ thích ⇒ không thêm
    expect((await none(commenter, 'comment_like')).length).toBe(1)
  })

  it('bài mới: báo người theo dõi tác giả (không báo người khác, người đã tắt loại này)', async () => {
    const author = await createUser(db)
    const follower = await createUser(db)
    const muted = await createUser(db)
    const stranger = await createUser(db)
    for (const f of [follower, muted]) await db.query(`INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)`, [f.id, author.id])
    const followerAgent = await loginAgent(app, follower)
    const mutedAgent = await loginAgent(app, muted)
    await mutedAgent.patch('/api/notifications/settings').send({ inApp: { followed_post: false } }).expect(200)

    const post = await (await loginAgent(app, author)).post('/api/posts').send({ content: 'Chia sẻ đề thi giữa kỳ' }).expect(201)
    const [n] = await waitFor(followerAgent, 'followed_post')
    expect(n.link).toBe(`/post/${post.body.data.id}`)
    expect(n.title).toContain('đã đăng bài viết mới')
    expect(await none(mutedAgent, 'followed_post')).toHaveLength(0)
    expect(await none(await loginAgent(app, stranger), 'followed_post')).toHaveLength(0)
  })

  it('nhóm học: trưởng nhóm được báo khi có người tham gia, người tham gia không tự báo mình', async () => {
    const leader = await createUser(db)
    const member = await createUser(db)
    const leaderAgent = await loginAgent(app, leader)
    const memberAgent = await loginAgent(app, member)
    const group = await leaderAgent
      .post('/api/study-groups')
      .send({ name: 'Nhóm ôn Giải tích', description: 'Ôn tập giữa kỳ cùng nhau', topic: 'Giải tích 1', maxMembers: 5 })
      .expect(201)
    await memberAgent.post(`/api/study-groups/${group.body.data.id}/join`).expect(201)

    const [n] = await waitFor(leaderAgent, 'group_member_joined')
    expect(n.title).toContain('đã tham gia nhóm học "Nhóm ôn Giải tích"')
    expect(await none(memberAgent, 'group_member_joined')).toHaveLength(0)
  })
})
