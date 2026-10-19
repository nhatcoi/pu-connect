import * as request from 'supertest'
import { randomBytes } from 'crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Feed "Dành cho bạn": hot-rank (bài mới nổi lên), đa dạng tác giả, giảm bài đã xem
describe('Feed hot ranking (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  // Tag riêng mỗi test ⇒ cô lập khỏi bài của test khác trên DB chung
  const newTag = () => `rank_${randomBytes(4).toString('hex')}`
  const insertPost = async (authorId: string, tag: string, content: string, hoursAgo: number, likes = 0, comments = 0) => {
    const res = await db.query(
      `INSERT INTO posts (author_id, title, content, tags, likes_count, comments_count, created_at)
       VALUES ($1, $2::text, $2::text, ARRAY[$3]::text[], $4, $5, NOW() - $6::float8 * interval '1 hour') RETURNING id`,
      [authorId, content, tag, likes, comments, hoursAgo]
    )
    return res.rows[0].id as string
  }
  const feed = async (tag: string, agent?: request.Agent) => {
    const res = await (agent ?? request(app.getHttpServer())).get(`/api/posts?tag=${tag}&feedType=for_you&limit=20`).expect(200)
    return (res.body.data as { content: string }[]).map((p) => p.content)
  }

  it('bài mới chưa tương tác vượt bài cũ nhiều like', async () => {
    const tag = newTag()
    const a = await createUser(db)
    const b = await createUser(db)
    await insertPost(a.id, tag, 'old-hot', 8 * 24, 21, 14)
    await insertPost(b.id, tag, 'fresh', 1)
    expect(await feed(tag)).toEqual(['fresh', 'old-hot'])
  })

  it('cùng tuổi ⇒ nhiều tương tác đứng trên', async () => {
    const tag = newTag()
    const a = await createUser(db)
    const b = await createUser(db)
    await insertPost(a.id, tag, 'quiet', 5)
    await insertPost(b.id, tag, 'liked', 5, 10, 3)
    expect(await feed(tag)).toEqual(['liked', 'quiet'])
  })

  it('một tác giả đăng dồn ⇒ bài thứ 3+ nhường chỗ người khác', async () => {
    const tag = newTag()
    const spam = await createUser(db)
    const other = await createUser(db)
    for (let i = 0; i < 4; i++) await insertPost(spam.id, tag, `spam-${i}`, 1 + i * 0.1)
    await insertPost(other.id, tag, 'other', 3)
    const order = await feed(tag)
    expect(order.slice(0, 2)).toEqual(['spam-0', 'spam-1'])
    expect(order.indexOf('other')).toBe(2)
  })

  it('bài đã lướt qua nhiều lần tụt xuống dưới', async () => {
    const tag = newTag()
    const viewer = await createUser(db)
    const a = await createUser(db)
    const b = await createUser(db)
    const seenId = await insertPost(a.id, tag, 'seen', 2)
    await insertPost(b.id, tag, 'unseen', 3)
    const agent = await loginAgent(app, viewer)
    expect(await feed(tag, agent)).toEqual(['seen', 'unseen'])

    await db.query(
      `INSERT INTO user_events (user_id, type, target_type, target_id, created_at)
       SELECT $1, 'post_view', 'post', $2, NOW() - interval '1 minute' FROM generate_series(1, 3)`,
      [viewer.id, seenId]
    )
    expect(await feed(tag, agent)).toEqual(['unseen', 'seen'])
  })
})
