import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Quản lý bài đăng: quyền xem (công khai / người theo dõi / riêng tư), lưu trữ, sửa đầy đủ
describe('Post management (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const follow = (followerId: string, followingId: string) => db.query(`INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [followerId, followingId])

  it('quyền xem: riêng tư chỉ tác giả, followers cho người theo dõi, công khai cho mọi người', async () => {
    const author = await createUser(db)
    const fan = await createUser(db)
    const stranger = await createUser(db)
    await follow(fan.id, author.id)
    const [authorAgent, fanAgent, strangerAgent] = await Promise.all([loginAgent(app, author), loginAgent(app, fan), loginAgent(app, stranger)])

    const mk = async (visibility: string) => (await authorAgent.post('/api/posts').send({ content: `Bài ${visibility}`, visibility }).expect(201)).body.data.id as string
    const [pub, fol, priv] = [await mk('public'), await mk('followers'), await mk('private')]

    // Xem trực tiếp
    await strangerAgent.get(`/api/posts/${pub}`).expect(200)
    await strangerAgent.get(`/api/posts/${fol}`).expect(404)
    await strangerAgent.get(`/api/posts/${priv}`).expect(404)
    await fanAgent.get(`/api/posts/${fol}`).expect(200)
    await fanAgent.get(`/api/posts/${priv}`).expect(404)
    await authorAgent.get(`/api/posts/${priv}`).expect(200)
    await request(app.getHttpServer()).get(`/api/posts/${fol}`).expect(404)

    // Tab Đang theo dõi của người theo dõi: thấy public + followers, không thấy riêng tư
    const feed = await fanAgent.get('/api/posts').query({ feedType: 'following', limit: 50 }).expect(200)
    const ids = (feed.body.data ?? feed.body).map((p: { id: string }) => p.id)
    expect(ids).toEqual(expect.arrayContaining([pub, fol]))
    expect(ids).not.toContain(priv)
  })

  it('lưu trữ: biến khỏi bảng tin, chỉ tác giả thấy, bỏ lưu trữ thì hiện lại', async () => {
    const author = await createUser(db)
    const fan = await createUser(db)
    await follow(fan.id, author.id)
    const authorAgent = await loginAgent(app, author)
    const fanAgent = await loginAgent(app, fan)
    const id = (await authorAgent.post('/api/posts').send({ content: 'Bài sẽ lưu trữ' }).expect(201)).body.data.id as string

    await authorAgent.post(`/api/posts/${id}/pin`).expect(201)
    // Người khác không lưu trữ được bài của mình
    await fanAgent.post(`/api/posts/${id}/archive`).expect(403)

    const res = await authorAgent.post(`/api/posts/${id}/archive`).expect(201)
    expect(res.body.data.archivedAt).toBeTruthy()
    const row = await db.query(`SELECT is_pinned, archived_at FROM posts WHERE id = $1`, [id])
    expect(row.rows[0].is_pinned).toBe(false)
    expect(row.rows[0].archived_at).not.toBeNull()

    const listed = async (agent: typeof fanAgent, feedType: string) => {
      const body = (await agent.get('/api/posts').query({ feedType, limit: 50 }).expect(200)).body
      return ((body.data?.data ?? body.data ?? body) as { id: string }[]).map((p) => p.id)
    }
    expect(await listed(fanAgent, 'following')).not.toContain(id)
    expect(await listed(authorAgent, 'archived')).toContain(id)
    expect(await listed(fanAgent, 'archived')).not.toContain(id)
    await fanAgent.get(`/api/posts/${id}`).expect(404)
    const mine = await authorAgent.get(`/api/posts/${id}`).expect(200)
    expect((mine.body.data ?? mine.body).archivedAt).toBeTruthy()

    await authorAgent.delete(`/api/posts/${id}/archive`).expect(200)
    expect(await listed(fanAgent, 'following')).toContain(id)
    expect(await listed(authorAgent, 'archived')).not.toContain(id)
    await fanAgent.get(`/api/posts/${id}`).expect(200)
  })

  it('sửa bài đủ trường: loại bài, học phần, quyền xem, thẻ, ảnh, xóa tiêu đề', async () => {
    const author = await createUser(db)
    const other = await createUser(db)
    const authorAgent = await loginAgent(app, author)
    const otherAgent = await loginAgent(app, other)
    const course = await db.query(`INSERT INTO courses (code, name, credits) VALUES ($1, 'Môn thử', 3) RETURNING id`, [`T${Date.now().toString(36).slice(-8).toUpperCase()}`])
    const courseId = course.rows[0].id as string

    const id = (await authorAgent.post('/api/posts').send({ title: 'Tiêu đề cũ', content: 'Nội dung cũ', tags: ['a'] }).expect(201)).body.data.id as string

    // Người khác không sửa được
    await otherAgent.patch(`/api/posts/${id}`).send({ content: 'Hack' }).expect(403)
    // Giá trị không hợp lệ
    await authorAgent.patch(`/api/posts/${id}`).send({ visibility: 'secret' }).expect(400)
    await authorAgent.patch(`/api/posts/${id}`).send({ postType: 'xyz' }).expect(400)
    await authorAgent.patch(`/api/posts/${id}`).send({ content: '   ' }).expect(400)
    await authorAgent.patch(`/api/posts/${id}`).send({ courseId: '00000000-0000-0000-0000-000000000000' }).expect(400)

    const res = await authorAgent
      .patch(`/api/posts/${id}`)
      .send({ title: '', content: 'Nội dung mới', tags: ['b', 'c'], postType: 'qa', courseId, visibility: 'followers', mediaUrls: ['https://cdn.test/a.png'] })
      .expect(200)
    expect(res.body.data).toMatchObject({ title: '', content: 'Nội dung mới', tags: ['b', 'c'], postType: 'qa', visibility: 'followers', courseId, mediaUrls: ['https://cdn.test/a.png'] })
    expect((await db.query(`SELECT post_count FROM courses WHERE id = $1`, [courseId])).rows[0].post_count).toBe(1)

    // Gỡ khỏi học phần ⇒ đếm giảm; chỉ đổi quyền xem không đụng nội dung
    const unset = await authorAgent.patch(`/api/posts/${id}`).send({ courseId: null, visibility: 'public' }).expect(200)
    expect(unset.body.data).toMatchObject({ courseId: null, visibility: 'public', content: 'Nội dung mới' })
    expect((await db.query(`SELECT post_count FROM courses WHERE id = $1`, [courseId])).rows[0].post_count).toBe(0)

    await db.query(`DELETE FROM courses WHERE id = $1`, [courseId])
  })

  it('bài ẩn danh: không đổi sang riêng tư / loại khác', async () => {
    const author = await createUser(db)
    const agent = await loginAgent(app, author)
    const id = (await agent.post('/api/posts').send({ content: 'Hỏi ẩn danh', postType: 'qa', isAnonymous: true }).expect(201)).body.data.id as string
    await agent.patch(`/api/posts/${id}`).send({ visibility: 'private' }).expect(400)
    await agent.patch(`/api/posts/${id}`).send({ postType: 'general' }).expect(400)
    await agent.patch(`/api/posts/${id}`).send({ content: 'Hỏi lại cho rõ hơn' }).expect(200)
  })
})
