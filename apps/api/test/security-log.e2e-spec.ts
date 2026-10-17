import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

describe('Nhật ký bảo mật & thiết bị đăng nhập (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('ghi đăng nhập đúng / sai, liệt kê & đăng xuất thiết bị khác', async () => {
    const user = await createUser(db)

    // Sai mật khẩu ⇒ login_failed gắn với tài khoản
    await request(app.getHttpServer()).post('/api/auth/login').send({ emailOrUsername: user.email, password: 'sai-mat-khau-123' }).expect(401)

    const phone = await loginAgent(app, user)
    const laptop = await loginAgent(app, user)

    const events = await laptop.get('/api/auth/security-events').expect(200)
    const kinds = events.body.data.map((e: { event: string }) => e.event)
    expect(kinds).toContain('login')
    expect(kinds).toContain('login_failed')

    const sessions = await laptop.get('/api/auth/sessions').expect(200)
    expect(sessions.body.data.length).toBe(2)
    expect(sessions.body.data.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
    // Không lộ sid thật
    expect(sessions.body.data[0].id).toMatch(/^[a-f0-9]{16}$/)

    await laptop.post('/api/auth/sessions/revoke-others').expect(200)
    await phone.get('/api/auth/me').expect(401)
    await laptop.get('/api/auth/me').expect(200)
  })

  it('admin xem tab Bảo mật (ghi audit), người thường bị chặn', async () => {
    const admin = await createUser(db, { role: 'admin' })
    const target = await createUser(db)
    await loginAgent(app, target)
    const adminAgent = await loginAgent(app, admin)

    const res = await adminAgent.get(`/api/admin/users/${target.id}/security`).expect(200)
    expect(res.body.data.events.length).toBeGreaterThan(0)
    const audit = await db.query(`SELECT 1 FROM admin_audit_logs WHERE action = 'user.security_view' AND target_id = $1`, [target.id])
    expect(audit.rowCount).toBe(1)

    const student = await loginAgent(app, await createUser(db))
    await student.get(`/api/admin/users/${target.id}/security`).expect(403)
  })
})
