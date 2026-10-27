import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { ModerationService } from '../src/modules/moderation/moderation.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Kiểm duyệt tự động (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let moderation: ModerationService
  let agent: Awaited<ReturnType<typeof loginAgent>>
  let userId: string
  const realClassifier = () => (moderation as any).classifier

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    moderation = app.get(ModerationService)
    const user = await createUser(db)
    userId = user.id
    agent = await loginAgent(app, user)
  })
  afterAll(async () => {
    delete process.env.MODERATION_MODE
    await app.close()
  })
  beforeEach(() => {
    process.env.MODERATION_MODE = 'enforce'
  })

  const events = (action?: string) =>
    db.query(`SELECT * FROM moderation_events WHERE user_id = $1 ${action ? 'AND action = $2' : ''} ORDER BY created_at`, action ? [userId, action] : [userId])

  it('mode off (mặc định): từ cấm vẫn đăng được, không ghi log', async () => {
    delete process.env.MODERATION_MODE
    const before = (await events()).rowCount
    await agent.post('/api/posts').send({ content: 'địt mẹ mày' }).expect(201)
    expect((await events()).rowCount).toBe(before)
  })

  it('enforce: từ cấm nặng ở bài viết → 400, không tạo bài, ghi event block', async () => {
    const res = await agent.post('/api/posts').send({ title: 'tiêu đề', content: 'đ.ị.t m3 mày' }).expect(400)
    expect(res.body.message ?? res.body.error).toBeTruthy()
    const posts = await db.query(`SELECT 1 FROM posts WHERE author_id = $1 AND content = 'đ.ị.t m3 mày'`, [userId])
    expect(posts.rowCount).toBe(0)
    const ev = await events('block')
    expect(ev.rowCount).toBeGreaterThan(0)
    expect(ev.rows[ev.rowCount! - 1]).toMatchObject({ surface: 'post', tier: 1, reason: 'profanity_heavy', enforced: true })
  })

  it('enforce: bình luận có từ cấm → 400', async () => {
    const post = await agent.post('/api/posts').send({ content: 'Bài bình thường để bình luận' }).expect(201)
    await agent.post(`/api/posts/${post.body.data.id}/comments`).send({ content: 'l0n' }).expect(400)
    await agent.post(`/api/posts/${post.body.data.id}/comments`).send({ content: 'Cảm ơn bạn nhiều' }).expect(201)
  })

  it('enforce: bài sạch qua model thật → 201, không ghi event', async () => {
    const before = (await events()).rowCount
    await agent.post('/api/posts').send({ content: 'Mọi người ơi cho mình hỏi lịch thi cuối kỳ môn giải tích' }).expect(201)
    expect((await events()).rowCount).toBe(before)
    expect(realClassifier()).toBeTruthy() // model ONNX đã được nạp và chạy
  })

  it('enforce: model báo hate → bài lưu nhưng ẩn (hidden_at), gắn target, không lên feed', async () => {
    const real = realClassifier()
    ;(moderation as any).classifier = { classify: async () => ({ clean: 0.05, offense: 0.15, hate: 0.8 }) }
    try {
      const res = await agent.post('/api/posts').send({ content: 'Nội dung giả lập bị model coi là thù ghét' }).expect(201)
      const id = res.body.data.id
      const row = await db.query(`SELECT hidden_at, hidden_reason FROM posts WHERE id = $1`, [id])
      expect(row.rows[0].hidden_at).not.toBeNull()
      expect(row.rows[0].hidden_reason).toBe('auto-moderation: hate')
      const ev = await db.query(`SELECT * FROM moderation_events WHERE target_id = $1`, [id])
      expect(ev.rows[0]).toMatchObject({ action: 'hold', tier: 2, reason: 'hate', target_type: 'post', review_status: 'pending' })

      const other = await loginAgent(app, await createUser(db))
      const feed = await other.get('/api/posts?limit=50').expect(200)
      expect(JSON.stringify(feed.body)).not.toContain(id)
    } finally {
      ;(moderation as any).classifier = real
    }
  })

  it('model lỗi → fail-open: chỉ dùng tầng 1, bài sạch vẫn đăng', async () => {
    const real = realClassifier()
    ;(moderation as any).classifier = {
      classify: async () => {
        throw new Error('boom')
      }
    }
    try {
      await agent.post('/api/posts').send({ content: 'Bài sạch khi model hỏng' }).expect(201)
      await agent.post('/api/posts').send({ content: 'lồn' }).expect(400) // tầng 1 vẫn chặn
    } finally {
      ;(moderation as any).classifier = real
    }
  })

  it('shadow: ghi log (enforced=false) nhưng không chặn', async () => {
    process.env.MODERATION_MODE = 'shadow'
    const res = await agent.post('/api/posts').send({ content: 'cặc mày shadow' }).expect(201)
    const row = await db.query(`SELECT hidden_at FROM posts WHERE id = $1`, [res.body.data.id])
    expect(row.rows[0].hidden_at).toBeNull()
    const ev = await events('block')
    expect(ev.rows.some((e) => e.enforced === false && e.content === 'cặc mày shadow')).toBe(true)
  })

  it('moderation_terms: từ admin thêm được nạp (cache 60s), bảng thiếu thì dùng từ điển gốc', async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS moderation_terms (term TEXT PRIMARY KEY, severity VARCHAR(10) NOT NULL, note TEXT)`)
    try {
      await db.query(`DELETE FROM moderation_terms`)
      ;(moderation as any).checker = null // bỏ cache
      await agent.post('/api/posts').send({ content: 'bài nói về củ khoai tím' }).expect(201)
      await db.query(`INSERT INTO moderation_terms (term, severity) VALUES ('khoai tím', 'heavy')`)
      await agent.post('/api/posts').send({ content: 'củ khoai tím nữa' }).expect(201) // còn cache cũ ⇒ chưa chặn
      ;(moderation as any).checker = null
      await agent.post('/api/posts').send({ content: 'củ khoai tím nữa' }).expect(400)
    } finally {
      await db.query(`DROP TABLE IF EXISTS moderation_terms`)
      ;(moderation as any).checker = null
    }
    await agent.post('/api/posts').send({ content: 'lồn' }).expect(400) // bảng mất ⇒ từ điển gốc vẫn chặn
  })
})
