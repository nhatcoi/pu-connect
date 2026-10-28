import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AdminCourseSuggestion, CourseSuggestion } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Đề xuất môn học: người dùng gợi ý, admin duyệt ⇒ tạo môn thật / từ chối kèm lý do
describe('Course suggestions (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  const tag = Math.random().toString(36).slice(2, 8)

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('cần đăng nhập; tên trùng môn có sẵn ⇒ 409; trùng đề xuất đang chờ ⇒ 409', async () => {
    await request(app.getHttpServer()).post('/api/courses/suggestions').send({ name: `Môn ${tag}` }).expect(401)
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    await db.query(`INSERT INTO courses (code, name, credits) VALUES ($1, $2, 3)`, [`SG${tag.toUpperCase()}`, `Có sẵn ${tag}`])
    await agent.post('/api/courses/suggestions').send({ name: `CÓ SẴN ${tag}` }).expect(409)
    await agent.post('/api/courses/suggestions').send({ name: `Môn mới ${tag}`, note: 'Thiếu môn này' }).expect(201)
    await agent.post('/api/courses/suggestions').send({ name: `môn mới ${tag}` }).expect(409)
    await agent.post('/api/courses/suggestions').send({ name: 'ab' }).expect(400)
    const mine = (await agent.get('/api/courses/suggestions/mine').expect(200)).body.data as CourseSuggestion[]
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ name: `Môn mới ${tag}`, status: 'pending', note: 'Thiếu môn này' })
  })

  it('tối đa 5 đề xuất chờ duyệt mỗi người', async () => {
    const agent = await loginAgent(app, await createUser(db))
    for (let i = 0; i < 5; i++) await agent.post('/api/courses/suggestions').send({ name: `Giới hạn ${tag} ${i}` }).expect(201)
    await agent.post('/api/courses/suggestions').send({ name: `Giới hạn ${tag} 6` }).expect(400)
  })

  it('admin duyệt ⇒ tạo môn thật; duyệt lại ⇒ 409; từ chối cần lý do và người đề xuất thấy', async () => {
    const user = await createUser(db)
    const admin = await createUser(db, { role: 'admin' })
    const userAgent = await loginAgent(app, user)
    const adminAgent = await loginAgent(app, admin)
    await userAgent.post('/api/courses/suggestions').send({ name: `Duyệt ${tag}` }).expect(201)
    await userAgent.post('/api/courses/suggestions').send({ name: `Từ chối ${tag}` }).expect(201)

    await userAgent.get('/api/admin/courses/suggestions').expect(403)
    const pending = (await adminAgent.get('/api/admin/courses/suggestions?status=pending').expect(200)).body.data as AdminCourseSuggestion[]
    const ok = pending.find((s) => s.name === `Duyệt ${tag}`)!
    const no = pending.find((s) => s.name === `Từ chối ${tag}`)!
    expect(ok.requester.username).toBe(user.username)

    const code = `DY${tag.toUpperCase()}`
    const approved = (await adminAgent.post(`/api/admin/courses/suggestions/${ok.id}/approve`).send({ code, name: ok.name, credits: 3 }).expect(200)).body.data
    expect((await db.query(`SELECT name FROM courses WHERE id = $1`, [approved.courseId])).rows[0].name).toBe(`Duyệt ${tag}`)
    await adminAgent.post(`/api/admin/courses/suggestions/${ok.id}/approve`).send({ code: `${code}X`, name: ok.name, credits: 3 }).expect(409)

    await adminAgent.post(`/api/admin/courses/suggestions/${no.id}/reject`).send({ note: '' }).expect(400)
    await adminAgent.post(`/api/admin/courses/suggestions/${no.id}/reject`).send({ note: 'Trùng với môn có sẵn' }).expect(200)

    const mine = (await userAgent.get('/api/courses/suggestions/mine').expect(200)).body.data as CourseSuggestion[]
    expect(mine.find((s) => s.name === `Duyệt ${tag}`)).toMatchObject({ status: 'approved', courseId: approved.courseId })
    expect(mine.find((s) => s.name === `Từ chối ${tag}`)).toMatchObject({ status: 'rejected', reviewNote: 'Trùng với môn có sẵn' })
  })
})
