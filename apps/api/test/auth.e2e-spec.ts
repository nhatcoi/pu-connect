import { createHash } from 'crypto'
import * as request from 'supertest'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent, PASSWORD } from './helpers'

describe('Auth (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('đăng nhập đúng mật khẩu tạo phiên, /auth/me trả về user', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const me = await agent.get('/api/auth/me').expect(200)
    expect(me.body.data.id).toBe(user.id)
    expect(me.body.data.status).toBe('active')
  })

  it('sai mật khẩu ⇒ 401', async () => {
    const user = await createUser(db)
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ emailOrUsername: user.email, password: 'wrong-password' })
      .expect(401)
  })

  describe('tài khoản bị khóa (suspended)', () => {
    it('đúng mật khẩu ⇒ 403 kèm thông báo bị khóa', async () => {
      const user = await createUser(db, { status: 'suspended' })
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ emailOrUsername: user.email, password: PASSWORD })
        .expect(403)
      expect(JSON.stringify(res.body)).toContain('bị khóa')
    })

    it('sai mật khẩu ⇒ 401 như thường (không lộ trạng thái khóa)', async () => {
      const user = await createUser(db, { status: 'suspended' })
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ emailOrUsername: user.email, password: 'wrong-password' })
        .expect(401)
    })

    it('bị khóa khi đang đăng nhập ⇒ phiên cũ hết hiệu lực', async () => {
      const user = await createUser(db)
      const agent = await loginAgent(app, user)
      await agent.get('/api/auth/me').expect(200)
      await db.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [user.id])
      await agent.get('/api/auth/me').expect(401)
    })
  })

  describe('đặt lại mật khẩu', () => {
    const token = 'a'.repeat(64)
    const tokenHash = createHash('sha256').update(token).digest('hex')

    it('token dùng một lần, đổi mật khẩu và hủy phiên cũ', async () => {
      const user = await createUser(db)
      const oldAgent = await loginAgent(app, user)
      await db.query(
        `UPDATE users SET reset_token_hash = $1, reset_token_expires = NOW() + INTERVAL '30 minutes' WHERE id = $2`,
        [tokenHash, user.id]
      )

      const server = app.getHttpServer()
      await request(server).post('/api/auth/reset-password').send({ token, password: 'NewPassword456!' }).expect(200)
      // Dùng lại token ⇒ từ chối
      await request(server).post('/api/auth/reset-password').send({ token, password: 'Another789!' }).expect(400)
      // Phiên đăng nhập trước khi đổi mật khẩu bị hủy
      await oldAgent.get('/api/auth/me').expect(401)

      await request(server)
        .post('/api/auth/login')
        .send({ emailOrUsername: user.email, password: 'NewPassword456!' })
        .expect(200)
      await request(server).post('/api/auth/login').send({ emailOrUsername: user.email, password: PASSWORD }).expect(401)
    })

    it('token hết hạn ⇒ 400', async () => {
      const user = await createUser(db)
      const expired = 'b'.repeat(64)
      await db.query(
        `UPDATE users SET reset_token_hash = $1, reset_token_expires = NOW() - INTERVAL '1 minute' WHERE id = $2`,
        [createHash('sha256').update(expired).digest('hex'), user.id]
      )
      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: expired, password: 'NewPassword456!' })
        .expect(400)
    })

    it('forgot-password luôn trả 200 dù email không tồn tại', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody-here@example.com' })
        .expect(200)
    })
  })
})
