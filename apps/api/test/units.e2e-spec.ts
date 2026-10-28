import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AdminUnitCatalog, AdminUnitRequest, UnitCatalog, UserProfile } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Trường đại học + lĩnh vực quan tâm: chọn từ danh mục, hoặc "Khác" + tên ⇒ admin duyệt rồi hồ sơ mới cập nhật
describe('Units (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  const tag = Math.random().toString(36).slice(2, 8)

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  const profile = async (agent: ReturnType<typeof request.agent>, username: string) => (await agent.get(`/api/users/${username}`).expect(200)).body.data as UserProfile

  it('danh mục công khai có Phenikaa và các lĩnh vực có sẵn', async () => {
    const catalog = (await request(app.getHttpServer()).get('/api/units').expect(200)).body.data as UnitCatalog
    expect(catalog.universities.map((u) => u.name)).toContain('Trường Đại học Phenikaa')
    expect(catalog.fields.length).toBeGreaterThan(3)
  })

  it('chọn trường / lĩnh vực có sẵn ⇒ hồ sơ hiện tên; chọn lại "Khác" trùng tên có sẵn ⇒ chọn luôn, không cần duyệt', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const catalog = (await request(app.getHttpServer()).get('/api/units').expect(200)).body.data as UnitCatalog
    const uni = catalog.universities[0]
    const field = catalog.fields[0]

    await agent.patch('/api/users/profile').send({ universityId: uni.id, interestFieldId: field.id }).expect(200)
    expect(await profile(agent, user.username)).toMatchObject({ universityId: uni.id, university: uni.name, interestFieldId: field.id, interestField: field.name })

    // Gõ lại đúng tên (khác hoa thường / dấu) ⇒ khớp danh mục
    await agent.patch('/api/users/profile').send({ interestFieldId: null, interestFieldOther: field.name.toUpperCase() }).expect(200)
    expect(await profile(agent, user.username)).toMatchObject({ interestFieldId: field.id })
    expect((await db.query(`SELECT 1 FROM unit_requests WHERE user_id = $1`, [user.id])).rowCount).toBe(0)

    await agent.patch('/api/users/profile').send({ universityId: 'khong-phai-uuid' }).expect(400)
    await agent.patch('/api/users/profile').send({ interestFieldId: null, interestFieldOther: null }).expect(200)
    expect(await profile(agent, user.username)).toMatchObject({ interestFieldId: null, interestField: null })
  })

  it('"Khác" ⇒ hiện "Khác" chờ duyệt; admin duyệt ⇒ tạo mục mới và cập nhật cả người cùng tên + thông báo', async () => {
    const [a, b, other] = [await createUser(db), await createUser(db), await createUser(db)]
    const admin = await createUser(db, { role: 'admin' })
    const agentA = await loginAgent(app, a)
    const agentB = await loginAgent(app, b)
    const adminAgent = await loginAgent(app, admin)
    const fieldName = `Lĩnh vực ${tag}`

    await agentA.patch('/api/users/profile').send({ interestFieldOther: fieldName, universityOther: `Đại học ${tag}` }).expect(200)
    await agentB.patch('/api/users/profile').send({ interestFieldOther: fieldName.toLowerCase() }).expect(200)
    const own = await profile(agentA, a.username)
    expect(own).toMatchObject({ interestFieldId: null, interestField: 'Khác', interestFieldRequest: fieldName, university: 'Khác', universityRequest: `Đại học ${tag}` })
    // Người khác chỉ thấy "Khác", không thấy tên đã gửi
    const seenByB = await profile(agentB, a.username)
    expect(seenByB.interestField).toBe('Khác')
    expect(seenByB.interestFieldRequest).toBeUndefined()

    await agentA.get('/api/admin/unit-requests').expect(403)
    const pending = (await adminAgent.get('/api/admin/unit-requests?status=pending').expect(200)).body.data as AdminUnitRequest[]
    const reqA = pending.find((r) => r.user.id === a.id && r.kind === 'field')!
    expect(reqA.sameNameCount).toBe(2)
    expect((await adminAgent.get('/api/admin/stats').expect(200)).body.data.pendingUnitRequests).toBeGreaterThanOrEqual(3)

    const approved = (await adminAgent.post(`/api/admin/unit-requests/${reqA.id}/approve`).send({ name: fieldName }).expect(200)).body.data
    expect(approved.users).toBe(2)
    await adminAgent.post(`/api/admin/unit-requests/${reqA.id}/approve`).send({}).expect(404)
    expect(await profile(agentA, a.username)).toMatchObject({ interestField: fieldName, interestFieldId: approved.unitId, interestFieldRequest: null })
    expect(await profile(agentB, b.username)).toMatchObject({ interestField: fieldName })
    // Trường của A vẫn chờ duyệt
    expect(await profile(agentA, a.username)).toMatchObject({ university: 'Khác' })
    const notified = await db.query(`SELECT 1 FROM notifications WHERE recipient_id = $1 AND type = 'account_notice'`, [a.id])
    expect(notified.rowCount).toBeGreaterThan(0)

    // Người chưa gửi gì không bị ảnh hưởng
    expect(await profile(await loginAgent(app, other), other.username)).toMatchObject({ interestFieldId: null })
  })

  it('admin từ chối ⇒ người dùng về chưa chọn; gộp vào mục có sẵn; môn học gắn lĩnh vực', async () => {
    const user = await createUser(db)
    const admin = await createUser(db, { role: 'admin' })
    const agent = await loginAgent(app, user)
    const adminAgent = await loginAgent(app, admin)
    const catalog = (await adminAgent.get('/api/admin/units').expect(200)).body.data as AdminUnitCatalog
    const existing = catalog.fields[0]

    await agent.patch('/api/users/profile').send({ interestFieldOther: `Từ chối ${tag}` }).expect(200)
    const rejectReq = ((await adminAgent.get('/api/admin/unit-requests').expect(200)).body.data as AdminUnitRequest[]).find((r) => r.user.id === user.id)!
    await adminAgent.post(`/api/admin/unit-requests/${rejectReq.id}/reject`).send({ reason: 'Không rõ nghĩa' }).expect(200)
    expect(await profile(agent, user.username)).toMatchObject({ interestFieldId: null, interestField: null })

    await agent.patch('/api/users/profile').send({ interestFieldOther: `Gộp ${tag}` }).expect(200)
    const mergeReq = ((await adminAgent.get('/api/admin/unit-requests').expect(200)).body.data as AdminUnitRequest[]).find((r) => r.user.id === user.id)!
    await adminAgent.post(`/api/admin/unit-requests/${mergeReq.id}/approve`).send({ name: 'x', existingId: existing.id }).expect(400)
    await adminAgent.post(`/api/admin/unit-requests/${mergeReq.id}/approve`).send({ existingId: existing.id }).expect(200)
    expect(await profile(agent, user.username)).toMatchObject({ interestFieldId: existing.id })

    // Môn học gắn theo lĩnh vực; danh mục môn trả tên lĩnh vực
    const code = `UN${tag.toUpperCase()}`
    await adminAgent.post('/api/admin/courses').send({ code, name: `Môn ${tag}`, credits: 3, fieldId: existing.id }).expect(201)
    const courses = (await request(app.getHttpServer()).get(`/api/courses?field=${existing.id}`).expect(200)).body.data as { code: string; fieldName: string }[]
    expect(courses.find((c) => c.code === code)).toMatchObject({ fieldName: existing.name })
  })

  it('admin thêm / đổi tên / tắt / gộp / xóa; mục còn người dùng thì không xóa được', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const adminAgent = await loginAgent(app, admin)
    const id = (await adminAgent.post('/api/admin/units').send({ kind: 'field', name: `Mới ${tag}` }).expect(201)).body.data.id as string
    await adminAgent.post('/api/admin/units').send({ kind: 'field', name: `MỚI ${tag}` }).expect(409)
    await adminAgent.patch(`/api/admin/units/field/${id}`).send({ name: `Đổi ${tag}` }).expect(200)
    await adminAgent.patch(`/api/admin/units/field/${id}`).send({ isActive: false }).expect(200)
    const publicFields = ((await request(app.getHttpServer()).get('/api/units').expect(200)).body.data as UnitCatalog).fields
    expect(publicFields.find((f) => f.id === id)).toBeUndefined()

    const user = await createUser(db)
    await db.query(`UPDATE users SET interest_field_id = $2 WHERE id = $1`, [user.id, id])
    await adminAgent.delete(`/api/admin/units/field/${id}`).expect(409)
    const target = ((await adminAgent.get('/api/admin/units').expect(200)).body.data as AdminUnitCatalog).fields.find((f) => f.id !== id)!
    const merged = (await adminAgent.post(`/api/admin/units/field/${id}/merge`).send({ targetId: target.id }).expect(200)).body.data
    expect(merged.movedUsers).toBe(1)
    expect((await db.query(`SELECT interest_field_id FROM users WHERE id = $1`, [user.id])).rows[0].interest_field_id).toBe(target.id)
  })
})
