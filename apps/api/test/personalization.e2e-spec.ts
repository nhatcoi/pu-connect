import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { FollowUpSplitter, parseFollowUps } from '../src/modules/chat/n7ai/n7ai.followups'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Cá nhân hóa (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('hành vi → hồ sơ quan tâm → gợi ý N7AI; tắt cá nhân hóa ⇒ xóa dữ liệu', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const agentA = await loginAgent(app, a)
    const agentB = await loginAgent(app, b)

    // Chưa có dữ liệu ⇒ gợi ý mặc định
    const empty = await agentA.get('/api/ai/suggestions?mode=quiz').expect(200)
    expect(empty.body.data.personalized).toBe(false)
    expect(empty.body.data.items).toHaveLength(4)

    // Tín hiệu bảng tin (thẻ bài viết, từ khóa tìm kiếm) không phải chủ đề học ⇒ không thành gợi ý
    const code = `PZ${Date.now().toString(36).toUpperCase()}`
    const course = await db.query(`INSERT INTO courses (code, name, credits) VALUES ($1, 'Lý thuyết đồ thị kiểm thử', 3) RETURNING id`, [code])
    const post = await agentB.post('/api/posts').send({ content: 'Thuật toán Dijkstra trên đồ thị có trọng số', tags: ['anuong', 'reviewquan'] }).expect(201)
    const postId = post.body.data.id
    await db.query(`INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2)`, [a.id, postId])
    await agentA
      .post('/api/events')
      .send({
        events: [
          { type: 'post_view', targetType: 'post', targetId: postId },
          { type: 'search', meta: { q: 'dijkstra', type: 'all' } }
        ]
      })
      .expect(204)
    await db.query(`UPDATE users SET interests_updated_at = NULL WHERE id = $1`, [a.id])
    const feedOnly = await agentA.get('/api/ai/suggestions?mode=quiz').expect(200)
    expect(feedOnly.body.data.personalized).toBe(false)
    expect(feedOnly.body.data.items.map((s: { text: string }) => s.text).join(' ')).not.toMatch(/anuong|reviewquan|dijkstra/i)

    // Gắn bài vào môn học ⇒ môn học trở thành chủ đề quan tâm
    await db.query(`UPDATE posts SET course_id = $2 WHERE id = $1`, [postId, course.rows[0].id])
    await db.query(`UPDATE users SET interests_updated_at = NULL WHERE id = $1`, [a.id])
    const quiz = await agentA.get('/api/ai/suggestions?mode=quiz').expect(200)
    expect(quiz.body.data.personalized).toBe(true)
    const texts: string[] = quiz.body.data.items.map((s: { text: string }) => s.text)
    expect(texts).toContain('Quiz 5 câu ôn tập môn Lý thuyết đồ thị kiểm thử')
    expect(quiz.body.data.items[0].topic).toMatchObject({ kind: 'course' })
    expect(texts.join(' ')).not.toMatch(/anuong|reviewquan|dijkstra/i)

    // "Hỏi đáp" ⇒ trộn nhiều chế độ
    const mixed = await agentA.get('/api/ai/suggestions').expect(200)
    expect(new Set(mixed.body.data.items.map((s: { mode: string }) => s.mode)).size).toBeGreaterThan(1)

    // Tắt ⇒ xóa sự kiện & hồ sơ, không ghi thêm, quay về gợi ý mặc định
    await agentA.patch('/api/users/privacy').send({ personalization: false }).expect(200)
    await agentA
      .post('/api/events')
      .send({ events: [{ type: 'post_open', targetType: 'post', targetId: postId }] })
      .expect(204)
    const left = await db.query(
      `SELECT (SELECT COUNT(*) FROM user_events WHERE user_id = $1)::int AS events,
              (SELECT COUNT(*) FROM user_interests WHERE user_id = $1)::int AS interests`,
      [a.id]
    )
    expect(left.rows[0]).toEqual({ events: 0, interests: 0 })
    const off = await agentA.get('/api/ai/suggestions?mode=quiz').expect(200)
    expect(off.body.data.personalized).toBe(false)
  })

  it('admin xem dữ liệu cá nhân hóa của 1 người: đủ phần, ghi nhật ký; người thường 403', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const target = await createUser(db)
    const agentAdmin = await loginAgent(app, admin)
    const agentTarget = await loginAgent(app, target)

    const post = await agentTarget
      .post('/api/posts')
      .send({ content: 'Ôn tập cây AVL', tags: ['CTDL'] })
      .expect(201)
    await agentTarget
      .post('/api/events')
      .send({ events: [{ type: 'post_open', targetType: 'post', targetId: post.body.data.id }] })
      .expect(204)
    await agentTarget.get('/api/ai/suggestions').expect(200) // tính hồ sơ

    await agentTarget.get(`/api/admin/users/${target.id}/insight`).expect(403)
    const res = await agentAdmin.get(`/api/admin/users/${target.id}/insight`).expect(200)
    const d = res.body.data
    expect(d.user.username).toBe(target.username)
    expect(d.personalization).toBe(true)
    expect(d.signals.postsAuthored).toBe(1)
    expect(d.eventCounts.post_open).toBe(1)
    expect(d.recentEvents[0]).toMatchObject({ type: 'post_open', tags: ['CTDL'] })
    expect(d.interests.map((t: { label: string }) => t.label)).toContain('ctdl')
    expect(d.suggestionPreview).toHaveLength(4)

    const log = await db.query(`SELECT 1 FROM admin_audit_logs WHERE admin_id = $1 AND action = 'user.insight_view' AND target_id = $2`, [admin.id, target.id])
    expect(log.rowCount).toBe(1)
    await agentAdmin.get('/api/admin/users/00000000-0000-0000-0000-000000000000/insight').expect(404)
  })

  it('gợi ý từ bộ sưu tập của mình: đứng đầu, kèm id bộ; bộ rỗng hoặc của người khác thì không', async () => {
    const owner = await createUser(db)
    const other = await createUser(db)
    const agent = await loginAgent(app, owner)
    const otherAgent = await loginAgent(app, other)
    const empty = (await db.query(`INSERT INTO document_collections (owner_id, title) VALUES ($1, 'Bộ rỗng') RETURNING id`, [owner.id])).rows[0].id
    expect((await agent.get('/api/ai/suggestions?mode=quiz').expect(200)).body.data.items.some((i: { collection?: unknown }) => i.collection)).toBe(false)

    const doc = (await db.query(`INSERT INTO documents (owner_id, title, file_url, status) VALUES ($1, 'GT1', 'https://x/y.pdf', 'published') RETURNING id`, [owner.id])).rows[0].id
    const col = (await db.query(`INSERT INTO document_collections (owner_id, title) VALUES ($1, 'Ôn thi Giải tích') RETURNING id`, [owner.id])).rows[0].id
    await db.query(`INSERT INTO document_collection_items (collection_id, document_id) VALUES ($1, $2)`, [col, doc])

    const first = (await agent.get('/api/ai/suggestions?mode=quiz').expect(200)).body.data.items[0]
    expect(first).toMatchObject({ mode: 'quiz', collection: { id: col, title: 'Ôn thi Giải tích' } })
    expect(first.text).toContain('Ôn thi Giải tích')
    expect(first.collection.id).not.toBe(empty)
    expect((await otherAgent.get('/api/ai/suggestions?mode=quiz').expect(200)).body.data.items.some((i: { collection?: unknown }) => i.collection)).toBe(false)
  })

  it('từ chối sự kiện không hợp lệ', async () => {
    const a = await createUser(db)
    const agentA = await loginAgent(app, a)
    await agentA
      .post('/api/events')
      .send({ events: [{ type: 'keylog' }] })
      .expect(400)
    await agentA
      .post('/api/events')
      .send({ events: [{ type: 'post_view', targetType: 'post', targetId: 'x' }] })
      .expect(400)
    await agentA.post('/api/events').send({ events: [] }).expect(400)
  })
})

describe('N7AI: tách câu hỏi gợi ý khỏi luồng trả lời', () => {
  it('không lộ dấu mốc dù bị cắt giữa các delta', () => {
    const s = new FollowUpSplitter()
    const chunks = ['Đáp án là 42.', '\n<<<FOLL', 'OWUPS>>>\n- Vì sao', ' lại là 42?\n- Ví dụ khác?\n- **Bài tập** tương tự']
    const shown = chunks.map((c) => s.push(c)).join('')
    const done = s.finish()
    expect(shown + done.rest).toBe('Đáp án là 42.\n')
    expect(done.followUps).toEqual(['Vì sao lại là 42?', 'Ví dụ khác?', 'Bài tập tương tự'])
  })

  it('không có dấu mốc ⇒ giữ nguyên văn bản (kể cả "<" cuối)', () => {
    const s = new FollowUpSplitter()
    const shown = ['a < b', ' và <<'].map((c) => s.push(c)).join('')
    const done = s.finish()
    expect(shown + done.rest).toBe('a < b và <<')
    expect(done.followUps).toEqual([])
    expect(parseFollowUps('1. Câu một?\n\n2) Câu hai?')).toEqual(['Câu một?', 'Câu hai?'])
  })
})
