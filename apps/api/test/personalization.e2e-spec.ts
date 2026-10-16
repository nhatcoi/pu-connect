import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { FollowUpSplitter, parseFollowUps } from '../src/modules/chat/puai/puai.followups'
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

  it('hành vi → hồ sơ quan tâm → gợi ý PU AI; tắt cá nhân hóa ⇒ xóa dữ liệu', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const agentA = await loginAgent(app, a)
    const agentB = await loginAgent(app, b)

    // Chưa có dữ liệu ⇒ gợi ý mặc định
    const empty = await agentA.get('/api/ai/suggestions?mode=quiz').expect(200)
    expect(empty.body.data.personalized).toBe(false)
    expect(empty.body.data.items).toHaveLength(4)

    const post = await agentB
      .post('/api/posts')
      .send({ content: 'Thuật toán Dijkstra trên đồ thị có trọng số', tags: ['Lý thuyết đồ thị'] })
      .expect(201)
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

    // Hồ sơ cũ (đã tính lúc rỗng) ⇒ ép tính lại
    await db.query(`UPDATE users SET interests_updated_at = NULL WHERE id = $1`, [a.id])
    const quiz = await agentA.get('/api/ai/suggestions?mode=quiz').expect(200)
    expect(quiz.body.data.personalized).toBe(true)
    const texts: string[] = quiz.body.data.items.map((s: { text: string }) => s.text)
    expect(texts).toContain('Quiz 5 câu về lý thuyết đồ thị')
    expect(texts).toContain('Quiz 5 câu về "dijkstra"')

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

describe('PU AI: tách câu hỏi gợi ý khỏi luồng trả lời', () => {
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
