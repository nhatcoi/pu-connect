import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { ConfigService } from '@nestjs/config'
import { LlmService } from '../src/modules/ai/llm.service'
import type { DatabaseService } from '../src/database/database.service'

// Gateway chính lỗi ⇒ tự chuyển gateway dự phòng (model riêng), nhớ 60s để không chờ lại gateway hỏng
function fake(status: number) {
  const hits: string[] = []
  const server: Server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      hits.push((JSON.parse(body) as { model: string }).model)
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(
        status === 200
          ? JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } })
          : JSON.stringify({ error: { message: 'down' } })
      )
    })
  })
  return new Promise<{ server: Server; hits: string[]; url: string }>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, hits, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` }))
  )
}

const llmFor = (env: Record<string, string>) => new LlmService({} as DatabaseService, { get: (k: string) => env[k] } as unknown as ConfigService)

describe('LlmService fallback gateway', () => {
  it('falls back on 5xx, then skips the primary during cooldown', async () => {
    const primary = await fake(503)
    const backup = await fake(200)
    const llm = llmFor({ AI_API_KEY: 'a', AI_BASE_URL: primary.url, AI_MODEL: 'v1', AI_FALLBACK_API_KEY: 'b', AI_FALLBACK_BASE_URL: backup.url, AI_FALLBACK_MODEL: 'v9' })
    expect((await llm.complete([{ role: 'user', content: 'hi' }])).text).toBe('ok')
    expect(backup.hits).toEqual(['v9'])
    const primaryHits = primary.hits.length
    await llm.complete([{ role: 'user', content: 'hi' }])
    expect(primary.hits.length).toBe(primaryHits)
    expect(backup.hits).toEqual(['v9', 'v9'])
    primary.server.close()
    backup.server.close()
  })

  it('does not fall back on a request error (400) or when no fallback is configured', async () => {
    const primary = await fake(400)
    const backup = await fake(200)
    const withBackup = llmFor({ AI_API_KEY: 'a', AI_BASE_URL: primary.url, AI_FALLBACK_API_KEY: 'b', AI_FALLBACK_BASE_URL: backup.url })
    await expect(withBackup.complete([{ role: 'user', content: 'hi' }])).rejects.toThrow()
    expect(backup.hits).toHaveLength(0)
    const alone = llmFor({ AI_API_KEY: 'a', AI_BASE_URL: primary.url })
    await expect(alone.complete([{ role: 'user', content: 'hi' }])).rejects.toThrow()
    primary.server.close()
    backup.server.close()
  })
})
