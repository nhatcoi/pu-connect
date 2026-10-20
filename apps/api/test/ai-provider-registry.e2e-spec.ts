import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { ConfigService } from '@nestjs/config'
import { AiProviderRegistry } from '../src/modules/ai/ai-provider.registry'
import { TokenCipher } from '../src/modules/ai/connectors/token-cipher'
import { LlmService } from '../src/modules/ai/llm.service'
import type { DatabaseService } from '../src/database/database.service'

const SECRET = 'test-secret'
const cipher = new TokenCipher(SECRET)

function fake(status: number) {
  const hits: { model: string; auth: string | undefined }[] = []
  const server: Server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      hits.push({ model: (JSON.parse(body) as { model: string }).model, auth: req.headers.authorization })
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(status === 200 ? JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }) : JSON.stringify({ error: { message: 'down' } }))
    })
  })
  return new Promise<{ server: Server; hits: typeof hits; url: string }>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, hits, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` }))
  )
}

const config = (env: Record<string, string>) => ({ get: (k: string) => env[k] }) as unknown as ConfigService
const row = (id: string, url: string, key: string, modelOverride: string | null = null) => ({ id, name: id, base_url: url, api_key_enc: cipher.encrypt(key), model_override: modelOverride })

// Provider trong DB: thứ tự thử, key giải mã đúng, lỗi gateway ⇒ provider kế tiếp, bảng rỗng ⇒ env
describe('AiProviderRegistry + LlmService (DB providers)', () => {
  it('calls providers in DB order with decrypted keys and per-provider model override', async () => {
    const a = await fake(503)
    const b = await fake(200)
    const db = { query: jest.fn().mockResolvedValue({ rows: [row('a', a.url, 'key-aaaaaaaa'), row('b', b.url, 'key-bbbbbbbb', 'backup-model')] }) } as unknown as DatabaseService
    const cfg = config({ SESSION_SECRET: SECRET, AI_MODEL: 'tier-x' })
    const llm = new LlmService(db, cfg, new AiProviderRegistry(db, cfg))
    expect((await llm.complete([{ role: 'user', content: 'hi' }])).text).toBe('ok')
    expect(a.hits.every((h) => h.model === 'tier-x' && h.auth === 'Bearer key-aaaaaaaa')).toBe(true)
    expect(b.hits).toEqual([{ model: 'backup-model', auth: 'Bearer key-bbbbbbbb' }])
    a.server.close()
    b.server.close()
  })

  it('falls back to env when the table is empty, unreadable or the key cannot be decrypted', async () => {
    const env = await fake(200)
    const cfg = config({ SESSION_SECRET: SECRET, AI_API_KEY: 'env-key-123', AI_BASE_URL: env.url })
    const empty = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as DatabaseService
    const broken = { query: jest.fn().mockRejectedValue(new Error('db down')) } as unknown as DatabaseService
    const wrongKey = { query: jest.fn().mockResolvedValue({ rows: [{ ...row('x', env.url, 'k'), api_key_enc: new TokenCipher('other').encrypt('k') }] }) } as unknown as DatabaseService
    for (const db of [empty, broken, wrongKey]) {
      const registry = new AiProviderRegistry(db, cfg)
      expect((await registry.chain()).map((p) => p.id)).toEqual(['env:primary'])
    }
    env.server.close()
  })

  it('skips a failing provider for the cooldown and resets on invalidate()', async () => {
    const cfg = config({ SESSION_SECRET: SECRET })
    const db = { query: jest.fn().mockResolvedValue({ rows: [row('a', 'http://a.invalid/v1', 'key-aaaaaaaa'), row('b', 'http://b.invalid/v1', 'key-bbbbbbbb')] }) } as unknown as DatabaseService
    const registry = new AiProviderRegistry(db, cfg)
    expect((await registry.chain()).map((p) => [p.id, p.primary])).toEqual([['a', true], ['b', false]])
    registry.markDown('a')
    expect((await registry.chain()).map((p) => [p.id, p.primary])).toEqual([['b', true]]) // primary = provider được thử đầu tiên
    registry.invalidate()
    expect((await registry.chain()).map((p) => p.id)).toEqual(['a', 'b'])
  })
})
