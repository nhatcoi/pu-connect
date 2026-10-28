import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { ModerationService } from '../src/modules/moderation/moderation.service'
import { AdminModerationEventsService } from '../src/modules/admin/moderation-events/moderation-events.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Bình luận bị gắn cờ chờ admin duyệt (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let moderation: ModerationService
  let review: AdminModerationEventsService
  let owner: Awaited<ReturnType<typeof loginAgent>>
  let author: Awaited<ReturnType<typeof loginAgent>>
  let other: Awaited<ReturnType<typeof loginAgent>>
  let ownerId: string
  let authorId: string
  let adminId: string
  let postId: string
  const realClassifier = () => (moderation as any).classifier

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    moderation = app.get(ModerationService)
    review = app.get(AdminModerationEventsService)
    const o = await createUser(db)
    const a = await createUser(db)
    ownerId = o.id
    authorId = a.id
    adminId = (await createUser(db, { role: 'admin' })).id
    owner = await loginAgent(app, o)
    author = await loginAgent(app, a)
    other = await loginAgent(app, await createUser(db))
    process.env.MODERATION_MODE = 'enforce'
    postId = (await owner.post('/api/posts').send({ content: 'Bài để bình luận kiểm duyệt' }).expect(201)).body.data.id
  })
  afterAll(async () => {
    delete process.env.MODERATION_MODE
    await app.close()
  })

  // Model giả lập: bình luận chứa "NGHI" bị coi là thù ghét nhẹ (flag)
  const flagging = async <T>(fn: () => Promise<T>): Promise<T> => {
    const real = realClassifier()
    ;(moderation as any).classifier = { classify: async () => ({ clean: 0.4, offense: 0.2, hate: 0.4 }) }
    try {
      return await fn()
    } finally {
      ;(moderation as any).classifier = real
    }
  }
  const listFor = async (agent: typeof owner) => JSON.stringify((await agent.get(`/api/posts/${postId}/comments`).expect(200)).body)
  const commentsCount = async () => (await db.query(`SELECT comments_count FROM posts WHERE id = $1`, [postId])).rows[0].comments_count as number
  const notices = async (userId: string, type: string, like = '%') =>
    (await db.query(`SELECT 1 FROM notifications WHERE recipient_id = $1 AND type = $2 AND coalesce(title, '') || coalesce(message, '') LIKE $3`, [userId, type, like])).rowCount

  let commentId: string
  let eventId: string

  it('bình luận bị gắn cờ: lưu chờ duyệt, tác giả thấy (pending), người khác không thấy, chưa đếm, chưa báo chủ bài', async () => {
    const res = await flagging(() => author.post(`/api/posts/${postId}/comments`).send({ content: 'Nội dung nghi ngờ vi phạm' }).expect(201))
    commentId = res.body.data.id
    expect(res.body.data.moderationStatus).toBe('pending')

    const row = (await db.query(`SELECT hidden_at, hidden_reason FROM comments WHERE id = $1`, [commentId])).rows[0]
    expect(row.hidden_at).not.toBeNull()
    expect(row.hidden_reason).toMatch(/^auto-moderation:/)

    expect(await listFor(author)).toContain(commentId)
    expect(await listFor(other)).not.toContain(commentId)
    expect(await listFor(owner)).not.toContain(commentId)
    expect(await commentsCount()).toBe(0)
    expect(await notices(ownerId, 'post_comment')).toBe(0)

    eventId = (await db.query(`SELECT id FROM moderation_events WHERE target_id = $1`, [commentId])).rows[0].id
  })

  it('tác giả không sửa được bình luận đang chờ duyệt', async () => {
    await author.patch(`/api/comments/${commentId}`).send({ content: 'sửa lại' }).expect(403)
  })

  it('admin bác cờ (dismissed): bình luận hiện cho mọi người, đếm +1, báo chủ bài và tác giả', async () => {
    const out = await review.review(adminId, [eventId], 'dismissed')
    expect(out.restored).toBe(1)
    expect(await listFor(other)).toContain(commentId)
    expect(await commentsCount()).toBe(1)
    await new Promise((r) => setTimeout(r, 300)) // thông báo gửi nền
    expect(await notices(ownerId, 'post_comment')).toBe(1)
    expect(await notices(authorId, 'account_notice')).toBeGreaterThan(0)
    expect(await notices(authorId, 'account_notice', '%duyệt và hiển thị%')).toBe(1)
  })

  it('admin xác nhận vi phạm (confirmed): bình luận vẫn ẩn với người khác, tác giả thấy "rejected", không đếm', async () => {
    const res = await flagging(() => author.post(`/api/posts/${postId}/comments`).send({ content: 'Một bình luận nghi ngờ khác' }).expect(201))
    const id = res.body.data.id
    const ev = (await db.query(`SELECT id FROM moderation_events WHERE target_id = $1`, [id])).rows[0].id
    await review.review(adminId, [ev], 'confirmed')

    expect(await listFor(other)).not.toContain(id)
    expect(await listFor(author)).toContain('"moderationStatus":"rejected"')
    expect(await commentsCount()).toBe(1)

    // Xóa bình luận đang ẩn không làm lệch bộ đếm
    await author.delete(`/api/comments/${id}`).expect(200)
    expect(await commentsCount()).toBe(1)
  })
})
