import type { NestExpressApplication } from '@nestjs/platform-express'
import * as request from 'supertest'
import type { DatabaseService } from '../src/database/database.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Key admin (pka_) + MCP admin: tách khỏi key user, allow-list đường dẫn, confirm, nhật ký
describe('Admin API keys & MCP (e2e)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  const H = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' }

  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
    await app.listen(0, '127.0.0.1')
    process.env.PORT = String((app.getHttpServer().address() as { port: number }).port)
  })
  afterAll(async () => {
    await app.close()
  })

  const http = () => request(app.getHttpServer())
  async function adminKey(scopes: string[], extra: object = {}) {
    const admin = await createUser(db, { role: 'admin' })
    const agent = await loginAgent(app, admin)
    const res = await agent.post('/api/admin/api-keys').send({ name: 'Ops', scopes, ...extra }).expect(201)
    return { admin, agent, key: res.body.data.key as string, id: res.body.data.id as string, item: res.body.data }
  }
  const rpc = (path: string, key: string, method: string, params: object = {}) =>
    http().post(path).set(H).set('Authorization', `Bearer ${key}`).send({ jsonrpc: '2.0', id: 1, method, params })
  const tool = (key: string, name: string, args: object) => rpc('/api/mcp/admin', key, 'tools/call', { name, arguments: args })

  it('chỉ admin có roles:manage tạo được key admin; key có hạn ≤ 30 ngày', async () => {
    const student = await createUser(db)
    await (await loginAgent(app, student)).post('/api/admin/api-keys').send({ name: 'x', scopes: ['admin_read'] }).expect(403)
    const { key, item } = await adminKey(['admin_read'])
    expect(key).toMatch(/^pka_/)
    const days = (new Date(item.expiresAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThanOrEqual(30.1)
  })

  it('key admin và key user tách biệt hoàn toàn', async () => {
    const { key } = await adminKey(['admin_read'])
    await http().get('/api/posts').set('Authorization', `Bearer ${key}`).expect(403) // không phải đường dẫn admin
    await rpc('/api/mcp', key, 'tools/list').expect(403) // MCP user từ chối key admin

    const user = await createUser(db)
    const ukey = (await (await loginAgent(app, user)).post('/api/api-keys').send({ name: 'u', scopes: ['read', 'write'] }).expect(201)).body.data.key
    await http().get('/api/admin/stats').set('Authorization', `Bearer ${ukey}`).expect(403)
    await rpc('/api/mcp/admin', ukey, 'tools/list').expect(403)
  })

  it('allow-list: key admin không đổi vai trò, không xóa người dùng, không quản lý key, không xuất CSV', async () => {
    const { key, admin } = await adminKey(['admin_read', 'admin_moderate', 'admin_users', 'admin_academic'])
    const target = await createUser(db)
    const auth = { Authorization: `Bearer ${key}` }
    await http().get('/api/admin/stats').set(auth).expect(200)
    await http().patch(`/api/admin/users/${target.id}/role`).set(auth).send({ role: 'admin' }).expect(403)
    await http().get('/api/admin/users/export').set(auth).expect(403)
    await http().get('/api/admin/api-keys').set(auth).expect(403)
    await http().post('/api/admin/users/bulk').set(auth).send({ ids: [target.id], action: 'suspend' }).expect(403)
    await http().get('/api/admin/ops/settings').set(auth).expect(403)
    expect(admin.id).toBeTruthy()
  })

  it('scope: chỉ đọc không ghi được; ghi cần confirm=true; tool lọc theo scope', async () => {
    const ro = await adminKey(['admin_read'])
    const roTools = ((await rpc('/api/mcp/admin', ro.key, 'tools/list').expect(200)).body.result.tools as { name: string }[]).map((t) => t.name)
    expect(roTools).toContain('admin_stats')
    expect(roTools).not.toContain('admin_suspend_user')
    const stats = await tool(ro.key, 'admin_stats', {}).expect(200)
    expect(stats.body.result.isError).toBeFalsy()

    const mod = await adminKey(['admin_read', 'admin_users'])
    const victim = await createUser(db)
    const noConfirm = await tool(mod.key, 'admin_suspend_user', { id: victim.id, reason: 'thử' }).expect(200)
    expect(noConfirm.body.error ?? noConfirm.body.result?.isError).toBeTruthy()
    expect((await db.query(`SELECT status FROM users WHERE id=$1`, [victim.id])).rows[0].status).toBe('active')
    const done = await tool(mod.key, 'admin_suspend_user', { id: victim.id, reason: 'thử', confirm: true }).expect(200)
    expect(done.body.result.isError).toBeFalsy()
    expect((await db.query(`SELECT status FROM users WHERE id=$1`, [victim.id])).rows[0].status).toBe('suspended')
    // thao tác đã vào nhật ký admin chung
    const audit = await db.query(`SELECT 1 FROM admin_audit_logs WHERE admin_id=$1 AND target_id=$2`, [mod.admin.id, victim.id])
    expect(audit.rowCount).toBeGreaterThan(0)
  })

  it('mọi lời gọi vào api_key_logs; thu hồi ⇒ 401', async () => {
    const { key, id, agent } = await adminKey(['admin_read'])
    await tool(key, 'admin_users_summary', {}).expect(200)
    await new Promise((r) => setTimeout(r, 200))
    const logs = (await agent.get('/api/admin/api-keys/logs').expect(200)).body.data
    expect(logs.some((l: { path: string }) => l.path.startsWith('admin/users/summary'))).toBe(true)
    await agent.delete(`/api/admin/api-keys/${id}`).expect(200)
    await tool(key, 'admin_stats', {}).expect(401)
  })

  it('khóa theo IP: IP lạ ⇒ 403', async () => {
    const { key } = await adminKey(['admin_read'], { ipAllow: ['203.0.113.9'] })
    await http().get('/api/admin/stats').set('Authorization', `Bearer ${key}`).expect(403)
  })
})
