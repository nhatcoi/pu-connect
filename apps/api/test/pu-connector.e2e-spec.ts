import type { NestExpressApplication } from '@nestjs/platform-express'
import { createHash } from 'crypto'
import { DatabaseService } from '../src/database/database.service'
import { PuConnectorMcpService } from '../src/modules/ai/connectors/pu-connector-mcp.service'
import { createTestApp, createUser, loginAgent } from './helpers'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('PU Connect / PKA', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  const realFetch = global.fetch
  const network: { url: string; body: Record<string, unknown>; authorization: string | null }[] = []
  let challenge = ''
  let grant = 'g'.repeat(43)
  beforeAll(async () => {
    global.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.startsWith('https://pka.vnhat.dev/')) return realFetch(input, init)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const authorization = new Headers(init?.headers).get('authorization')
      network.push({ url, body, authorization })
      if (url.endsWith('/token')) {
        expect(createHash('sha256').update(body.code_verifier).digest('base64url')).toBe(challenge)
        return json({ access_token: grant, account: 'Sinh viên · fixture' })
      }
      if (url.endsWith('/revoke')) return json({ revoked: true })
      if (body.method === 'initialize')
        return json({
          jsonrpc: '2.0',
          id: body.id,
          result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'pu-connector', version: '1' } }
        })
      if (body.method?.startsWith('notifications/')) return new Response(null, { status: 202 })
      if (body.method === 'tools/call') return json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{"studentId":"fixture"}' }] } })
      return new Response(null, { status: 405 })
    }) as typeof fetch
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    global.fetch = realFetch
    await app?.close()
  })

  it('pairs with session-bound PKCE, encrypts the grant, rejects replay, stays lazy and revokes access', async () => {
    const user = await createUser(db)
    const other = await createUser(db)
    const agent = await loginAgent(app, user)
    const list = await agent.get('/api/ai/connectors').expect(200)
    expect(list.body.data.find((item: { id: string }) => item.id === 'pu_connector')).toMatchObject({
      name: 'PU Connect',
      requiresAuth: true,
      connected: false
    })
    const begin = await agent.get('/api/ai/connectors/pu-connector/connect').expect(302)
    const destination = new URL(begin.headers.location)
    expect(destination.origin).toBe('https://pka.vnhat.dev')
    challenge = destination.searchParams.get('code_challenge')!
    const state = destination.searchParams.get('state')!
    const callback = '/api/ai/connectors/pu-connector/callback?code=' + 'c'.repeat(43) + '&state=' + state
    expect((await (await loginAgent(app, other)).get(callback).expect(302)).headers.location).toContain('result=error')
    network.length = 0
    expect((await agent.get(callback).expect(302)).headers.location).toContain('result=connected')
    expect(network).toHaveLength(1)
    const saved = await db.query("SELECT refresh_token_enc, scope FROM user_connectors WHERE user_id = $1 AND provider = 'pu_connector'", [user.id])
    expect(saved.rows[0].refresh_token_enc).not.toContain(grant)
    expect(saved.rows[0].scope).toBe('academic.read')
    expect((await agent.get(callback).expect(302)).headers.location).toContain('result=error')
    const preferences = await db.query('SELECT default_connectors FROM ai_settings WHERE user_id = $1', [user.id])
    expect(preferences.rows[0].default_connectors).toContain('pu_connector')

    network.length = 0
    const session = app.get(PuConnectorMcpService).open(user.id, AbortSignal.timeout(15_000))
    expect(session.tools).toHaveLength(8)
    expect(network).toHaveLength(0)
    const read = JSON.parse(await session.call('pu_connector__profile', {}))
    expect(read.isError).toBe(false)
    expect(network.every((item) => item.authorization === 'Bearer ' + grant)).toBe(true)
    expect(network.some((item) => item.body.method === 'tools/call')).toBe(true)
    expect(JSON.parse(await session.call('pu_connector__delete_course', {})).error).toBeDefined()
    const isolated = app.get(PuConnectorMcpService).open(other.id, AbortSignal.timeout(15_000))
    expect(JSON.parse(await isolated.call('pu_connector__profile', {})).error).toBeDefined()
    await isolated.close()
    const oldGrant = grant
    grant = 'h'.repeat(43)
    const reconnect = new URL((await agent.get('/api/ai/connectors/pu-connector/connect').expect(302)).headers.location)
    challenge = reconnect.searchParams.get('code_challenge')!
    await agent.get('/api/ai/connectors/pu-connector/callback?code=' + 'c'.repeat(43) + '&state=' + reconnect.searchParams.get('state')).expect(302)
    expect(network.some((item) => item.url.endsWith('/revoke') && item.authorization === 'Bearer ' + oldGrant)).toBe(true)
    expect(JSON.parse(await session.call('pu_connector__profile', {})).error).toBeDefined()
    await agent.delete('/api/ai/connectors/pu-connector').expect(200)
    expect(network.some((item) => item.url.endsWith('/revoke'))).toBe(true)
    expect(JSON.parse(await session.call('pu_connector__profile', {})).error).toBeDefined()
    await session.close()
    expect((await db.query("SELECT 1 FROM user_connectors WHERE user_id = $1 AND provider = 'pu_connector'", [user.id])).rows).toHaveLength(0)
  })
})
