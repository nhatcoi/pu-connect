import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Trạng thái hoạt động (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('chỉ người cùng hội thoại; ẩn khi chặn hoặc tắt trạng thái', async () => {
    const a = await createUser(db)
    const b = await createUser(db)
    const stranger = await createUser(db)
    const agentA = await loginAgent(app, a)
    const agentB = await loginAgent(app, b)

    await agentA.post('/api/conversations/direct').send({ userId: b.id }).expect(200)
    await db.query(`UPDATE users SET last_seen_at = NOW() - INTERVAL '5 minutes' WHERE id = $1`, [b.id])

    const map = await agentA.get('/api/presence').expect(200)
    expect(Object.keys(map.body.data)).toEqual([b.id])
    expect(map.body.data[b.id]).toMatchObject({ online: false })
    expect(map.body.data[b.id].lastSeenAt).toBeTruthy()
    expect(map.body.data[stranger.id]).toBeUndefined()

    // B tắt trạng thái ⇒ A không thấy B, B cũng không thấy ai (có qua có lại)
    await agentB.patch('/api/users/privacy').send({ showActivityStatus: false }).expect(200)
    expect((await agentA.get('/api/presence').expect(200)).body.data).toEqual({})
    expect((await agentB.get('/api/presence').expect(200)).body.data).toEqual({})
    const privacy = await db.query(`SELECT privacy_settings FROM users WHERE id = $1`, [b.id])
    expect(privacy.rows[0].privacy_settings).toMatchObject({ showActivityStatus: false, showStudentId: true })

    // Bật lại nhưng bị chặn ⇒ vẫn ẩn
    await agentB.patch('/api/users/privacy').send({ showActivityStatus: true }).expect(200)
    await agentA.put(`/api/blocks/${b.id}`).expect(204)
    expect((await agentB.get('/api/presence').expect(200)).body.data).toEqual({})
  })

  it('từ chối privacy sai kiểu', async () => {
    const a = await createUser(db)
    const agentA = await loginAgent(app, a)
    await agentA.patch('/api/users/privacy').send({ showActivityStatus: 'yes' }).expect(400)
  })
})
