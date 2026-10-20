import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AiStep } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import { GoogleOAuthService } from '../src/modules/ai/connectors/google-oauth.service'
import { GoogleMcpService } from '../src/modules/ai/connectors/google-mcp.service'
import { McpAgentService } from '../src/modules/ai/mcp-agent.service'
import { LlmService } from '../src/modules/ai/llm.service'
import { N7AiService } from '../src/modules/chat/n7ai/n7ai.service'
import { createTestApp, createUser, loginAgent } from './helpers'

const SCOPES = {
  drive: 'drive.readonly',
  calendar: 'calendar.readonly',
  gmail: 'gmail.readonly',
  forms: 'forms',
  sheets: 'spreadsheets',
  tasks: 'tasks'
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
// workspace-mcp advertises every service's tools (read + write) on one endpoint; N7AI filters per provider
const MCP_URL = 'http://workspace-mcp.test/mcp'
const TOOLS = [
  'search_drive_files',
  'get_drive_file_content',
  'create_drive_file',
  'list_calendars',
  'get_events',
  'manage_event',
  'search_gmail_messages',
  'get_gmail_thread_content',
  'send_gmail_message',
  'create_form',
  'batch_update_form',
  'get_form',
  'list_form_responses',
  'read_sheet_values',
  'create_spreadsheet',
  'append_table_rows',
  'list_tasks',
  'manage_task'
]

// Real SDK and DB; only Google / workspace-mcp network and model responses are intercepted.
// LlmService tối giản: chat() thật chạy trên một provider giả (không DB / mạng)
const llmStub = (create: unknown) => {
  const client = { chat: { completions: { create } } }
  return { client, model: 'test', providers: { chain: async () => [{ id: 't', name: 't', client, modelOverride: null, primary: true }], markDown: () => undefined }, logger: { warn: () => undefined }, isGatewayFailure: () => false, chat: LlmService.prototype.chat } as unknown as LlmService
}

describe('Google MCP connectors', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  const realFetch = global.fetch
  const calls: { host: string; method: string; name?: string; args?: Record<string, unknown>; token: string }[] = []
  let tokenResponse: () => Response
  let rejectOldToken = false
  const keys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'GOOGLE_MCP_CLIENT_ID',
    'GOOGLE_MCP_CLIENT_SECRET',
    'CONNECTOR_ENCRYPTION_KEY',
    'GOOGLE_WORKSPACE_MCP_URL'
  ]
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  beforeAll(async () => {
    Object.assign(process.env, {
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_CALLBACK_URL: 'https://puc.test/api/auth/google/callback',
      GOOGLE_MCP_CLIENT_ID: 'mcp-cid',
      GOOGLE_MCP_CLIENT_SECRET: 'mcp-secret',
      CONNECTOR_ENCRYPTION_KEY: 'test-key',
      GOOGLE_WORKSPACE_MCP_URL: MCP_URL
    })
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.hostname === 'oauth2.googleapis.com') return url.pathname === '/token' ? tokenResponse() : json({})
      if (url.href !== MCP_URL) return realFetch(input, init)
      const token = new Headers(init?.headers).get('Authorization') ?? ''
      if (rejectOldToken && token === 'Bearer old-access') return json({ error: 'expired' }, 401)
      if (init?.method === 'GET') return new Response(null, { status: 405 })
      const req = JSON.parse(String(init?.body ?? '{}'))
      calls.push({ host: url.hostname, method: req.method, name: req.params?.name, args: req.params?.arguments, token })
      if (req.method?.startsWith('notifications/')) return new Response(null, { status: 202 })
      let result: unknown
      if (req.method === 'initialize')
        result = { protocolVersion: req.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'google-test', version: '1' } }
      else if (req.method === 'tools/list')
        result = {
          tools: TOOLS.map((name) => ({
            name,
            description: name,
            inputSchema: { type: 'object', properties: { query: { type: 'string' }, calendarId: { type: 'string' }, timeMin: { type: 'string' } } },
            annotations: { readOnlyHint: true }
          }))
        }
      else if (req.method === 'tools/call')
        result = {
          content: [{ type: 'text', text: JSON.stringify({ source: req.params.name, arguments: req.params.arguments, text: 'Thông tin từ Google MCP' }) }]
        }
      else throw new Error(`Unexpected MCP method ${req.method}`)
      return json({ jsonrpc: '2.0', id: req.id, result })
    }) as typeof fetch
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    global.fetch = realFetch
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    await app.close()
  })
  beforeEach(() => {
    calls.length = 0
    rejectOldToken = false
  })

  async function connect(agent: Awaited<ReturnType<typeof loginAgent>>, provider: keyof typeof SCOPES, access = 'access-token') {
    const scopes =
      provider === 'forms'
        ? ['https://www.googleapis.com/auth/forms.body', 'https://www.googleapis.com/auth/forms.responses.readonly']
        : [`https://www.googleapis.com/auth/${SCOPES[provider]}`]
    const start = await agent.get(`/api/ai/connectors/google-${provider}/connect`).expect(302)
    const auth = new URL(start.headers.location)
    expect(auth.searchParams.get('client_id')).toBe('mcp-cid')
    expect(auth.searchParams.get('scope')).toContain(scopes[0])
    expect(auth.searchParams.get('access_type')).toBe('offline')
    tokenResponse = () =>
      json({
        access_token: access,
        refresh_token: 'rt-secret',
        expires_in: 3600,
        scope: `openid email ${scopes.join(' ')}`,
        id_token: `x.${Buffer.from(JSON.stringify({ email: 'student@example.test' })).toString('base64url')}.y`
      })
    const result = await agent.get(`/api/auth/google/callback?code=c&state=${auth.searchParams.get('state')}`).expect(302)
    expect(result.headers.location).toContain('result=connected')
  }

  it('connects Drive/Calendar/Gmail/Forms/Sheets/Tasks, discovers MCP tools, denies writes and isolates accounts', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    for (const provider of ['drive', 'calendar', 'gmail', 'forms', 'sheets', 'tasks'] as const) await connect(agent, provider)
    const row = await db.query('SELECT refresh_token_enc FROM user_connectors WHERE user_id = $1', [user.id])
    expect(row.rows[0].refresh_token_enc).not.toContain('rt-secret')
    const list = (await agent.get('/api/ai/connectors').expect(200)).body.data
    expect(list.filter((c: { connected: boolean; requiresAuth: boolean }) => c.connected && c.requiresAuth)).toHaveLength(6)
    await agent
      .patch('/api/ai/settings')
      .send({ defaultConnectors: ['google_gmail', 'google_forms', 'google_sheets', 'google_tasks'] })
      .expect(200)
    const mcp = app.get(GoogleMcpService)
    const session = await mcp.open(
      user.id,
      ['google_drive', 'google_calendar', 'google_gmail', 'google_forms', 'google_sheets', 'google_tasks'],
      AbortSignal.timeout(15_000)
    )
    try {
      expect(session.errors).toEqual([])
      const names = session.tools.map((t) => (t.type === 'function' ? t.function.name : ''))
      expect(names).toContain('google_gmail__search_gmail_messages')
      expect(names).toContain('google_forms__create_form')
      expect(names).toContain('google_forms__get_form')
      expect(names).toContain('google_sheets__create_spreadsheet')
      expect(names).toContain('google_sheets__read_sheet_values')
      expect(names).toContain('google_tasks__manage_task')
      expect(names).toContain('google_tasks__list_tasks')
      expect(session.readOnly?.('google_forms__create_form')).toBe(false)
      expect(session.readOnly?.('google_forms__get_form')).toBe(true)
      expect(session.readOnly?.('google_sheets__create_spreadsheet')).toBe(false)
      expect(session.readOnly?.('google_sheets__read_sheet_values')).toBe(true)
      expect(session.readOnly?.('google_tasks__manage_task')).toBe(false)
      expect(session.readOnly?.('google_tasks__list_tasks')).toBe(true)
      expect(session.readOnly?.('google_drive__search_drive_files')).toBe(true)
      expect(names.join(' ')).not.toMatch(/create_drive_file|manage_event|send_gmail_message/)
      expect(await session.call('google_calendar__get_events', { calendarId: 'school', timeMin: '2030-06-01T00:00:00Z' })).toContain('school')
      expect(calls.find((c) => c.name === 'get_events')?.args?.timeMin).toBe('2030-06-01T00:00:00Z')
      const count = calls.length
      expect(await session.call('google_gmail__send_gmail_message', {})).toContain('error')
      expect(calls).toHaveLength(count)
      const other = await mcp.open((await createUser(db)).id, ['google_drive'], AbortSignal.timeout(15_000))
      expect(other.tools).toHaveLength(0)
      expect(other.errors).toHaveLength(1)
      await other.close()
      await agent.delete('/api/ai/connectors/google-calendar').expect(200)
      expect(await session.call('google_calendar__get_events', {})).toContain('Đã ngắt')
    } finally {
      await session.close()
    }
  })

  it('refreshes an expired bearer once and removes a revoked grant', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    await connect(agent, 'drive', 'old-access')
    rejectOldToken = true
    tokenResponse = () => json({ access_token: 'fresh-access', expires_in: 3600 })
    const session = await app.get(GoogleMcpService).open(user.id, ['google_drive'], AbortSignal.timeout(15_000))
    expect(session.errors).toEqual([])
    await session.call('google_drive__search_drive_files', { query: "title contains 'Giải tích'" })
    expect(calls.filter((c) => c.name === 'search_drive_files').every((c) => c.token === 'Bearer fresh-access')).toBe(true)
    await session.close()
    tokenResponse = () => json({ error: 'invalid_grant' }, 400)
    expect(await app.get(GoogleOAuthService).accessToken(user.id, 'google_drive', true)).toBeNull()
    expect((await db.query('SELECT 1 FROM user_connectors WHERE user_id = $1', [user.id])).rows).toHaveLength(0)
  })

  it('executes model-selected multi-step tools and aggregates streaming usage', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    await connect(agent, 'calendar')
    await connect(agent, 'gmail')
    const warmup = await app.get(GoogleMcpService).open(user.id, ['google_calendar', 'google_gmail'], AbortSignal.timeout(15_000))
    await warmup.close()
    let turn = 0
    const create = jest.fn(() =>
      Promise.resolve(
        (async function* () {
          const current = turn++
          if (current < 2) {
            const name = current === 0 ? 'google_calendar__get_events' : 'google_gmail__search_gmail_messages'
            const args = current === 0 ? '{"calendarId":"school"}' : '{"query":"subject:thi"}'
            yield { choices: [{ delta: { tool_calls: [{ index: 0, id: `call-${current}`, function: { name, arguments: args.slice(0, 5) } }] } }] }
            yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: args.slice(5) } }] }, finish_reason: 'tool_calls' }] }
          } else yield { choices: [{ delta: { content: 'Lịch học và email đã được đối chiếu.' }, finish_reason: 'stop' }] }
          yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } }
        })()
      )
    )
    const loop = new McpAgentService(
      llmStub(create),
      app.get(GoogleMcpService)
    )
    const output: string[] = []
    const progress: AiStep[][] = []
    const result = await loop.stream(
      [{ role: 'user', content: 'Đối chiếu lịch trường với email về kỳ thi' }],
      user.id,
      ['google_calendar', 'google_gmail'],
      (text) => output.push(text),
      (steps) => progress.push(steps)
    )
    expect(output.join('')).toContain('đã được đối chiếu')
    expect(result.calls).toHaveLength(2)
    expect(result.calls.every((c) => c.ok)).toBe(true)
    expect(result.usage).toEqual({ prompt_tokens: 30, completion_tokens: 15 })
    expect(calls.some((c) => c.name === 'search_gmail_messages')).toBe(true)
    // Tiến trình: mỗi tool 1 lần running + 1 lần xong; nhãn tiếng Việt, chi tiết = từ khóa
    expect(progress.map((p) => p.map((s) => s.status).join(','))).toEqual(['running', 'done', 'done,running', 'done,done'])
    expect(result.steps).toEqual([
      expect.objectContaining({ provider: 'google_calendar', label: 'Đọc sự kiện trong lịch', status: 'done' }),
      expect.objectContaining({ provider: 'google_gmail', label: 'Tìm thư trong Gmail', detail: 'subject:thi', status: 'done' })
    ])
  })

  it('does not expose private connectors to group replies even with forged connector metadata', async () => {
    const owner = await createUser(db)
    const member = await createUser(db)
    const agent = await loginAgent(app, owner)
    const conv = (
      await agent
        .post('/api/conversations')
        .send({ title: 'Group', memberIds: [member.id] })
        .expect(201)
    ).body.data
    const trigger = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, kind, content, meta) VALUES ($1, $2, 'text', 'Hỏi lịch', $3) RETURNING id`,
      [conv.id, owner.id, JSON.stringify({ connectors: ['google_gmail', 'google_calendar'] })]
    )
    const llm = app.get(LlmService)
    const original = llm.client
    Object.assign(llm, { client: {} })
    const spy = jest.spyOn(app.get(McpAgentService), 'stream').mockImplementation(async (_messages, _userId, connectors, emit) => {
      expect(connectors).toEqual([])
      emit('Trả lời trong nhóm')
      return { usage: { prompt_tokens: 1, completion_tokens: 1 }, finishReason: 'stop', calls: [], steps: [] }
    })
    try {
      expect(await app.get(N7AiService).reply(conv.id, owner.id, String(trigger.rows[0].id))).toBe('done')
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
      Object.assign(llm, { client: original })
    }
  })

  it('defers MCP discovery until needed, caches schemas per account and checks disconnect before execution', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    await connect(agent, 'drive')
    const mcp = app.get(GoogleMcpService)
    const lazy = await mcp.open(user.id, ['google_drive'], AbortSignal.timeout(15_000), { lazy: true })
    expect(calls).toHaveLength(0)
    expect(lazy.tools).toEqual([expect.objectContaining({ function: expect.objectContaining({ name: 'google_drive__discover_tools' }) })])
    expect(JSON.parse(await lazy.call('google_drive__discover_tools', {})).availableTools).toContain('google_drive__search_drive_files')
    expect(lazy.tools.some((t) => t.type === 'function' && t.function.name === 'google_drive__search_drive_files')).toBe(true)
    await lazy.close()
    calls.length = 0
    const warm = await mcp.open(user.id, ['google_drive'], AbortSignal.timeout(15_000), { lazy: true })
    expect(calls).toHaveLength(0)
    expect(warm.tools.some((t) => t.type === 'function' && t.function.name === 'google_drive__discover_tools')).toBe(false)
    const other = await mcp.open((await createUser(db)).id, ['google_drive'], AbortSignal.timeout(15_000), { lazy: true })
    expect(other.tools).toHaveLength(0) // tài khoản chưa kết nối Drive ⇒ model không thấy tool Drive (không gọi nhầm rồi báo lỗi)
    await other.close()
    await agent.delete('/api/ai/connectors/google-drive').expect(200)
    expect(JSON.parse(await warm.call('google_drive__search_drive_files', { query: 'AI' })).error).toBeDefined()
    expect(calls).toHaveLength(0)
    await warm.close()
  })

  it('discovers a cold Google catalog inside the model loop and uses the newly exposed tools', async () => {
    const user = await createUser(db)
    await connect(await loginAgent(app, user), 'calendar')
    let turn = 0
    const create = jest.fn(async (params: { tools: { function?: { name: string } }[] }) => {
      const current = turn++
      const name = current === 0 ? 'google_calendar__discover_tools' : 'google_calendar__get_events'
      if (current < 2) expect(params.tools.some((t) => t.function?.name === name)).toBe(true)
      return (async function* () {
        if (current < 2)
          yield {
            choices: [{ delta: { tool_calls: [{ index: 0, id: `cold-${current}`, function: { name, arguments: '{}' } }] }, finish_reason: 'tool_calls' }]
          }
        else yield { choices: [{ delta: { content: 'Đã đọc lịch' }, finish_reason: 'stop' }] }
      })()
    })
    const loop = new McpAgentService(
      llmStub(create),
      app.get(GoogleMcpService)
    )
    const result = await loop.stream([{ role: 'user', content: 'Đọc lịch' }], user.id, ['google_calendar'], () => undefined)
    expect(result.timings.rounds).toBe(3)
    expect(result.calls.every((c) => c.ok)).toBe(true)
    expect(calls.some((c) => c.name === 'get_events')).toBe(true)
  })

  it('rejects a grant missing required scopes', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const start = await agent.get('/api/ai/connectors/google-gmail/connect').expect(302)
    const state = new URL(start.headers.location).searchParams.get('state')
    tokenResponse = () => json({ access_token: 'at', refresh_token: 'rt', scope: 'openid email' })
    const result = await agent.get(`/api/auth/google/callback?code=c&state=${state}`).expect(302)
    expect(result.headers.location).toContain('result=error')
    expect((await db.query('SELECT 1 FROM user_connectors WHERE user_id = $1', [user.id])).rows).toHaveLength(0)
  })

  it('bounds repeated model tool calls and always closes the MCP session', async () => {
    let rounds = 0
    const call = jest.fn(async () => JSON.stringify({ data: 'ok' }))
    const close = jest.fn(async () => undefined)
    const create = jest.fn(async () =>
      (async function* () {
        rounds++
        yield {
          choices: [
            {
              delta: { tool_calls: [{ index: 0, id: `c-${rounds}`, function: { name: 'google_drive__search_drive_files', arguments: '{}' } }] },
              finish_reason: 'tool_calls'
            }
          ]
        }
      })()
    )
    const mcp = {
      open: async () => ({
        tools: [{ type: 'function', function: { name: 'google_drive__search_drive_files', parameters: { type: 'object' } } }],
        instructions: [],
        call,
        describe: () => ({ provider: 'google_drive', label: 'Tìm tệp trong Drive' }),
        close
      })
    } as unknown as GoogleMcpService
    const llm = { client: { chat: { completions: { create } } }, model: 'test', chat: LlmService.prototype.chat } as unknown as LlmService
    const result = await new McpAgentService(llm, mcp).stream([{ role: 'user', content: 'Search' }], 'account', ['google_drive'], () => undefined)
    expect(rounds).toBe(4)
    expect(call).toHaveBeenCalledTimes(3)
    expect(result.finishReason).toBe('length')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('closes clients after model failure and exposes a useful gateway compatibility error', async () => {
    const close = jest.fn(async () => undefined)
    const mcp = {
      open: async () => ({
        tools: [{ type: 'function', function: { name: 'google_drive__search_drive_files', parameters: { type: 'object' } } }],
        instructions: [],
        call: jest.fn(),
        describe: () => null,
        close
      })
    } as unknown as GoogleMcpService
    const llm = {
      client: {
        chat: {
          completions: {
            create: async () => {
              throw { status: 400 }
            }
          }
        }
      },
      model: 'test',
      chat: LlmService.prototype.chat
    } as unknown as LlmService
    await expect(new McpAgentService(llm, mcp).stream([], 'account', ['google_drive'], () => undefined)).rejects.toThrow('tool calling')
    expect(close).toHaveBeenCalledTimes(1)
  })
})
