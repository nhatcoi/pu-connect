import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent, PASSWORD } from './helpers'

describe('Admin (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('người thường bị chặn ở /admin (403), khách 401', async () => {
    const student = await createUser(db)
    const agent = await loginAgent(app, student)
    await agent.get('/api/admin/stats').expect(403)
    await request(app.getHttpServer()).get('/api/admin/stats').expect(401)
  })

  it('ẩn bài bị báo cáo: đóng báo cáo, bài biến khỏi feed, ghi nhật ký', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const author = await createUser(db)
    const reporter = await createUser(db)
    const adminAgent = await loginAgent(app, admin)
    const authorAgent = await loginAgent(app, author)
    const reporterAgent = await loginAgent(app, reporter)

    const post = await authorAgent.post('/api/posts').send({ content: 'Nội dung vi phạm' }).expect(201)
    const postId = post.body.data.id
    await reporterAgent.post(`/api/posts/${postId}/report`).send({ reason: 'spam', details: 'quảng cáo' })

    const reports = await adminAgent.get('/api/admin/reports').expect(200)
    expect(reports.body.data.some((r: { postId: string }) => r.postId === postId)).toBe(true)

    await adminAgent.post(`/api/admin/posts/${postId}/hide`).send({ reason: 'spam' }).expect(200)

    const pending = await db.query(`SELECT COUNT(*)::int AS n FROM post_reports WHERE post_id = $1 AND status = 'pending'`, [postId])
    expect(pending.rows[0].n).toBe(0)

    // Người khác không xem được, tác giả vẫn xem được
    await reporterAgent.get(`/api/posts/${postId}`).expect(404)
    await authorAgent.get(`/api/posts/${postId}`).expect(200)
    const feed = await reporterAgent.get('/api/posts?limit=50').expect(200)
    expect(feed.body.data.some((p: { id: string }) => p.id === postId)).toBe(false)

    const logs = await adminAgent.get('/api/admin/audit-logs').expect(200)
    expect(logs.body.data[0]).toMatchObject({ action: 'post.hide', targetId: postId })

    await adminAgent.post(`/api/admin/posts/${postId}/unhide`).expect(200)
    await reporterAgent.get(`/api/posts/${postId}`).expect(200)
  })

  it('khóa tài khoản: hủy phiên đang mở, chặn đăng nhập; mở khóa thì đăng nhập lại được', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const target = await createUser(db)
    const adminAgent = await loginAgent(app, admin)
    const targetAgent = await loginAgent(app, target)

    await adminAgent.post(`/api/admin/users/${target.id}/suspend`).send({ reason: 'spam' }).expect(200)
    await targetAgent.get('/api/auth/me').expect(401)
    await request(app.getHttpServer()).post('/api/auth/login').send({ emailOrUsername: target.email, password: PASSWORD }).expect(403)

    await adminAgent.post(`/api/admin/users/${target.id}/unsuspend`).expect(200)
    await loginAgent(app, target)
  })

  it('không khóa được admin khác hoặc chính mình', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const other = await createUser(db, { role: 'admin' })
    const agent = await loginAgent(app, admin)
    await agent.post(`/api/admin/users/${other.id}/suspend`).send({}).expect(403)
    await agent.post(`/api/admin/users/${admin.id}/suspend`).send({}).expect(400)
  })

  it('liệt kê từ khóa tìm không có kết quả', async () => {
    const admin = await createUser(db, { role: 'admin' })
    await db.query(`INSERT INTO search_logs (q_norm, search_type, result_count) VALUES ('lich thi xyz', 'all', 0), ('lich thi xyz', 'all', 0)`)
    const agent = await loginAgent(app, admin)
    const res = await agent.get('/api/admin/search/zero-results').expect(200)
    expect(res.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ query: 'lich thi xyz', count: 2 })]))
  })
})
