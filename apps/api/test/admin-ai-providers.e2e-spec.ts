import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ConfigService } from '@nestjs/config'
import { DatabaseService } from '../src/database/database.service'
import { AdminAiProvidersService } from '../src/modules/admin/admin-ai-providers.service'
import { AiProviderCreateBodySchema, AiProviderPatchBodySchema } from '../src/modules/admin/dto/admin-ai-providers.dto'
import { AiProviderRegistry } from '../src/modules/ai/ai-provider.registry'
import { createUser } from './helpers'

const SECRET = 'test-secret'
const URL_A = 'https://gateway-a.example.com/v1'
const URL_B = 'http://gateway-b.example.com:8080/v1'

// Admin › N7AI › Provider (service + DB thật): CRUD, thứ tự, mã hóa key, thử kết nối, nhật ký không lộ key
describe('Admin AI providers', () => {
  let db: DatabaseService
  let registry: AiProviderRegistry
  let service: AdminAiProvidersService
  let adminId: string
  let models: Server
  let modelsUrl: string

  beforeAll(async () => {
    db = new DatabaseService()
    const config = { get: (k: string) => (k === 'SESSION_SECRET' ? SECRET : undefined) } as unknown as ConfigService
    registry = new AiProviderRegistry(db, config)
    service = new AdminAiProvidersService(db, config, registry)
    adminId = (await createUser(db, { role: 'admin' })).id
    models = createServer((req, res) => {
      res.writeHead(req.headers.authorization === 'Bearer sk-live-key-0000' ? 200 : 401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }))
    })
    await new Promise<void>((r) => models.listen(0, '127.0.0.1', r))
    modelsUrl = `http://127.0.0.1:${(models.address() as AddressInfo).port}/v1`
  })
  beforeEach(async () => {
    await db.query(`DELETE FROM ai_providers`)
    registry.invalidate()
  })
  afterAll(async () => {
    await db.query(`DELETE FROM ai_providers`)
    models.close()
    await db.onModuleDestroy()
  })

  const names = async () => (await service.list()).items.map((p) => p.name)

  it('thêm / đổi thứ tự / sửa / xóa; key mã hóa và không bao giờ trả ra', async () => {
    // Không có provider trong DB và không có cấu hình env ⇒ source 'database' (chỉ báo 'env' khi env có provider, xem ca cuối)
    expect(await service.list()).toMatchObject({ source: 'database', items: [], env: [] })

    await service.create(adminId, { name: 'A', baseUrl: URL_A, apiKey: 'sk-secret-AAAA1111' })
    await service.create(adminId, { name: 'B', baseUrl: URL_B, apiKey: 'sk-secret-BBBB2222', modelOverride: 'backup' })
    const list = await service.list()
    expect(list.source).toBe('database')
    expect(list.items.map((p) => p.name)).toEqual(['A', 'B'])
    expect(list.items[0]).toMatchObject({ keyHint: '1111', enabled: true, baseUrl: URL_A, modelOverride: null })
    expect(list.items[1]).toMatchObject({ keyHint: '2222', modelOverride: 'backup' })
    expect(JSON.stringify(list)).not.toContain('secret')
    expect((await db.query(`SELECT api_key_enc FROM ai_providers`)).rows.every((r) => !r.api_key_enc.includes('secret'))).toBe(true)

    // Registry thấy provider ngay sau khi admin ghi (invalidate, không chờ TTL)
    expect((await registry.chain()).map((p) => [p.name, p.primary, p.modelOverride])).toEqual([['A', true, null], ['B', false, 'backup']])

    const [a, b] = list.items
    await service.move(adminId, b.id, 'up')
    expect(await names()).toEqual(['B', 'A'])
    expect((await registry.chain())[0].name).toBe('B')
    await service.move(adminId, b.id, 'up') // đã đứng đầu ⇒ không đổi
    expect(await names()).toEqual(['B', 'A'])

    await service.update(adminId, a.id, { enabled: false, apiKey: 'sk-secret-CCCC3333' })
    expect((await service.list()).items.find((p) => p.name === 'A')).toMatchObject({ enabled: false, keyHint: '3333' })
    expect((await registry.chain()).map((p) => p.name)).toEqual(['B'])
    await service.update(adminId, a.id, { name: 'A2', baseUrl: URL_A }) // không gửi apiKey ⇒ giữ key cũ
    expect((await service.list()).items.find((p) => p.name === 'A2')).toMatchObject({ keyHint: '3333' })

    await service.remove(adminId, a.id)
    await expect(service.remove(adminId, a.id)).rejects.toThrow('không tồn tại')
    await service.remove(adminId, b.id)
    expect((await service.list()).source).toBe('database') // hết provider và không có env

    const audit = await db.query(`SELECT action, details FROM admin_audit_logs WHERE target_type = 'ai_provider'`)
    expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['ai_provider.create', 'ai_provider.move', 'ai_provider.update', 'ai_provider.delete']))
    expect(JSON.stringify(audit.rows)).not.toContain('secret')
  })

  it('thử kết nối: OK có độ trễ + số model, key sai bị báo, không lộ nội dung', async () => {
    await service.create(adminId, { name: 'Live', baseUrl: modelsUrl, apiKey: 'sk-live-key-0000' })
    await service.create(adminId, { name: 'BadKey', baseUrl: modelsUrl, apiKey: 'sk-wrong-key-9999' })
    await service.create(adminId, { name: 'Dead', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'sk-dead-key-0000' })
    const byName = Object.fromEntries((await service.list()).items.map((p) => [p.name, p.id]))
    const ok = await service.test(byName.Live)
    expect(ok).toMatchObject({ ok: true, models: 3 })
    expect(typeof ok.latencyMs).toBe('number')
    const denied = await service.test(byName.BadKey)
    expect(denied).toMatchObject({ ok: false, models: null })
    expect(denied.error).toContain('401')
    const dead = await service.test(byName.Dead)
    expect(dead).toMatchObject({ ok: false, error: 'Không kết nối được tới URL này' })
    expect(JSON.stringify([denied, dead])).not.toContain('sk-')
    await expect(service.test('00000000-0000-0000-0000-000000000000')).rejects.toThrow('không tồn tại')
  })

  it('nhập cấu hình env: thiếu AI_API_KEY ⇒ 400; có key ⇒ chuyển sang DB (mã hóa), chạy lần 2 ⇒ 409', async () => {
    await expect(service.importFromEnv(adminId)).rejects.toThrow('AI_API_KEY')
    const config = { get: (k: string) => ({ SESSION_SECRET: SECRET, AI_API_KEY: 'sk-env-key-7777', AI_BASE_URL: 'https://env.example.com', AI_FALLBACK_API_KEY: 'sk-env-fb-8888', AI_FALLBACK_BASE_URL: 'https://fb.example.com/v1', AI_FALLBACK_MODEL: 'v9' })[k] } as unknown as ConfigService
    const withEnv = new AdminAiProvidersService(db, config, new AiProviderRegistry(db, config))
    expect(await withEnv.importFromEnv(adminId)).toEqual({ imported: 2 })
    const items = (await service.list()).items
    expect(items.map((p) => [p.name, p.baseUrl, p.keyHint, p.modelOverride])).toEqual([
      ['Gateway chính', 'https://env.example.com/v1', '7777', null],
      ['Gateway dự phòng', 'https://fb.example.com/v1', '8888', 'v9']
    ])
    await expect(withEnv.importFromEnv(adminId)).rejects.toThrow('Đã có provider')
  })

  it('DTO: từ chối URL sai, URL chứa tài khoản, key ngắn, model lạ, patch rỗng; chuẩn hóa dấu / cuối', () => {
    const ok = { name: 'X', baseUrl: URL_A, apiKey: 'sk-long-enough-key' }
    expect(AiProviderCreateBodySchema.safeParse(ok).success).toBe(true)
    expect(AiProviderCreateBodySchema.parse({ ...ok, baseUrl: 'https://x.com/v1///' }).baseUrl).toBe('https://x.com/v1')
    for (const bad of [{ baseUrl: 'ftp://x.com/v1' }, { baseUrl: 'https://user:pass@x.com/v1' }, { baseUrl: 'not a url' }, { apiKey: 'short' }, { modelOverride: 'bad model!' }, { name: ' ' }]) {
      expect(AiProviderCreateBodySchema.safeParse({ ...ok, ...bad }).success).toBe(false)
    }
    expect(AiProviderPatchBodySchema.safeParse({}).success).toBe(false)
    expect(AiProviderPatchBodySchema.safeParse({ modelOverride: null }).success).toBe(true)
  })
  it('DB không có provider bật nhưng có cấu hình env ⇒ list() báo source = env', async () => {
    const config = { get: (k: string) => ({ SESSION_SECRET: SECRET, AI_API_KEY: 'sk-env-key-0000', AI_BASE_URL: 'https://env.example.com' } as Record<string, string>)[k] } as unknown as ConfigService
    const withEnv = new AdminAiProvidersService(db, config, new AiProviderRegistry(db, config))
    expect(await withEnv.list()).toMatchObject({ source: 'env', items: [] })
  })
})
