import type { NestExpressApplication } from '@nestjs/platform-express'
import type { AiRunTimings } from '@pu/schemas'
import type { DatabaseService } from '../src/database/database.service'
import type { AgentToolSession } from '../src/modules/ai/agent-tools'
import { AgentToolRunner } from '../src/modules/ai/agent-tool-runner'
import { AgentSources } from '../src/modules/ai/agent-sources'
import { AiRetrieval, toTsQuery } from '../src/modules/ai/ai.retrieval'
import { GoogleOAuthService } from '../src/modules/ai/connectors/google-oauth.service'
import { RagSearchService } from '../src/modules/ai/rag/rag-search.service'
import { PucToolsService } from '../src/modules/chat/n7ai/agent/puc-tools.service'
import { N7AiService } from '../src/modules/chat/n7ai/n7ai.service'
import { createTestApp, createUser, loginAgent, stubProviders } from './helpers'

const metrics = (): AiRunTimings => ({ modelWaitMs: 0, modelStreamMs: 0, toolWallMs: 0, mcpOpenMs: 0, rounds: 0, toolCalls: 0, cacheHits: 0 })
const request = (name: string, args = '{}', id = name) => ({ id, name, arguments: args })
const session = (call: AgentToolSession['call']): AgentToolSession => ({
  tools: [],
  instructions: [],
  readOnly: (name) => name.startsWith('read'),
  describe: () => ({ provider: 'puc', label: 'Read' }),
  call,
  close: async () => undefined
})

describe('Agent harness scheduling', () => {
  it('preserves AI acronyms for full-text search without treating Vietnamese ai as a keyword', () => {
    expect(toTsQuery('AI')).toBe('ai')
    expect(toTsQuery('ai là gì')).toBe('')
  })

  it('runs independent reads together, keeps result order and uses writes as barriers', async () => {
    const started: string[] = []
    const releases: (() => void)[] = []
    const call = jest.fn(async (name: string) => {
      started.push(name)
      if (name === 'readA' || name === 'readB') await new Promise<void>((resolve) => releases.push(resolve))
      return JSON.stringify({ name })
    })
    const runner = new AgentToolRunner(session(call), AbortSignal.timeout(1000), 8, metrics(), () => undefined)
    const pending = runner.batch(
      ['readA', 'readB', 'write', 'readC'].map((n) => request(n)),
      true
    )
    expect(started).toEqual(['readA', 'readB'])
    releases[1]()
    releases[0]()
    expect((await pending).map((s) => JSON.parse(s).name)).toEqual(['readA', 'readB', 'write', 'readC'])
    expect(started).toEqual(['readA', 'readB', 'write', 'readC'])
    expect(runner.steps.every((step) => typeof step.durationMs === 'number')).toBe(true)
  })

  it('single-flights equivalent read arguments across rounds; never caches writes or another reply', async () => {
    const call = jest.fn(async () => JSON.stringify({ data: 'ok' }))
    const timing = metrics()
    const runner = new AgentToolRunner(session(call), AbortSignal.timeout(1000), 8, timing, () => undefined)
    await runner.batch([request('read', '{"a":1,"b":2}', 'a'), request('read', '{"b":2,"a":1}', 'b')], true)
    await runner.batch([request('read', '{"a":1,"b":2}', 'c'), request('write'), request('write')], true)
    expect(call).toHaveBeenCalledTimes(3)
    await runner.batch([request('read', '{"a":1,"b":2}')], true)
    expect(call).toHaveBeenCalledTimes(4)
    expect(timing.cacheHits).toBe(2)
    const other = new AgentToolRunner(session(call), AbortSignal.timeout(1000), 8, metrics(), () => undefined)
    await other.batch([request('read', '{"a":1,"b":2}')], true)
    expect(call).toHaveBeenCalledTimes(5)
  })

  it('bounds concurrent calls and returns an error promptly when the turn is aborted', async () => {
    const call = jest.fn(async () => '{}')
    const runner = new AgentToolRunner(session(call), AbortSignal.timeout(1000), 2, metrics(), () => undefined)
    const result = await runner.batch(
      ['readA', 'readB', 'readC'].map((n) => request(n)),
      true
    )
    expect(call).toHaveBeenCalledTimes(2)
    expect(JSON.parse(result[2]).error).toBeDefined()
    const controller = new AbortController()
    const blocked = new AgentToolRunner(
      session(async () => new Promise<string>(() => undefined)),
      controller.signal,
      2,
      metrics(),
      () => undefined
    )
    const waiting = blocked.batch([request('read')], true)
    controller.abort()
    expect(JSON.parse((await waiting)[0]).error).toBeDefined()
  })

  it('does not cache failed reads', async () => {
    const call = jest.fn().mockResolvedValueOnce('{"error":"retry"}').mockResolvedValue('{"data":"ok"}')
    const runner = new AgentToolRunner(session(call), AbortSignal.timeout(1000), 8, metrics(), () => undefined)
    await runner.batch([request('read')], true)
    expect(JSON.parse((await runner.batch([request('read')], true))[0])).toEqual({ data: 'ok' })
    expect(call).toHaveBeenCalledTimes(2)
  })
})

describe('N7AI demand-driven retrieval', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  beforeAll(async () => {
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    await app.close()
  })

  it('answers a greeting in one model call without retrieval, embedding or Google authentication', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const thread = (await agent.post('/api/ai/threads').expect(200)).body.data
    const trigger = (
      await db.query(`INSERT INTO messages (conversation_id, sender_id, content, meta) VALUES ($1, $2, 'xin chào là gì', $3) RETURNING id`, [
        thread.id,
        user.id,
        JSON.stringify({ connectors: ['library', 'google_drive'] })
      ])
    ).rows[0].id
    const retrieval = jest.spyOn(app.get(AiRetrieval), 'retrieve')
    const embedding = jest.spyOn(app.get(RagSearchService), 'prepare')
    const oauth = jest.spyOn(app.get(GoogleOAuthService), 'accessToken')
    const create = jest.fn(async () =>
      (async function* () {
        yield { choices: [{ delta: { content: '“Xin chào” là lời chào khi gặp nhau.' }, finish_reason: 'stop' }] }
        yield { choices: [], usage: { prompt_tokens: 12, completion_tokens: 8 } }
      })()
    )
    const restoreLlm = stubProviders(app, { chat: { completions: { create } } })
    try {
      expect(await app.get(N7AiService).reply(thread.id, user.id, String(trigger))).toBe('done')
      expect(create).toHaveBeenCalledTimes(1)
      expect(retrieval).not.toHaveBeenCalled()
      expect(embedding).not.toHaveBeenCalled()
      expect(oauth).not.toHaveBeenCalled()
      const reply = (await db.query(`SELECT meta FROM messages WHERE conversation_id = $1 AND kind = 'ai' ORDER BY id DESC LIMIT 1`, [thread.id])).rows[0]
      expect(reply.meta.timings).toMatchObject({ rounds: 1, toolCalls: 0, cacheHits: 0 })
      expect(typeof reply.meta.timings.preparationMs).toBe('number')
      expect(reply.meta.steps).toBeUndefined()
    } finally {
      restoreLlm()
      retrieval.mockRestore()
      embedding.mockRestore()
      oauth.mockRestore()
    }
  })

  it('batches keyword variants, deduplicates sources and rechecks read permissions; groups receive only public sources', async () => {
    const user = await createUser(db)
    const other = await createUser(db)
    const title = `Harnessmaterials${Date.now()}`
    const insert = async (owner: string, visibility: string) =>
      (
        await db.query(
          `INSERT INTO documents (owner_id, title, description, file_url, visibility) VALUES ($1, $2, 'Nội dung chi tiết học máy', 'https://cdn.test/material.txt', $3) RETURNING id`,
          [owner, title, visibility]
        )
      ).rows[0].id as string
    const publicId = await insert(user.id, 'public')
    const privateId = await insert(user.id, 'private')
    const otherId = await insert(other.id, 'private')
    const rag = jest.spyOn(app.get(RagSearchService), 'prepare').mockImplementation(async (_q, tsquery) => ({ tsquery, vector: null }))
    try {
      const catalog = new AgentSources([])
      const tools = app.get(PucToolsService).open(user.id, ['library'], catalog)
      const found = JSON.parse(await tools.call('puc__search', { query: title, queries: [title, `${title} học máy`], type: 'documents' })).data.documents
      expect(found.map((d: { id: string }) => d.id).sort()).toEqual([publicId, privateId].sort())
      expect(new Set(found.map((d: { n: number }) => d.n)).size).toBe(2)
      expect(found.every((d: { excerpt: string }) => d.excerpt.length <= 450)).toBe(true)
      expect(rag).toHaveBeenCalledTimes(2)
      expect(JSON.parse(await tools.call('puc__read', { type: 'document', id: publicId })).data.content).toContain('Nội dung chi tiết')
      expect(JSON.parse(await tools.call('puc__read', { type: 'document', id: otherId })).error).toBeDefined()
      const group = app.get(PucToolsService).open(user.id, ['library'], new AgentSources([]), true)
      const shared = JSON.parse(await group.call('puc__search', { query: title, type: 'documents' })).data.documents
      expect(shared.map((d: { id: string }) => d.id)).toEqual([publicId])
      await db.query(`UPDATE documents SET visibility = 'private', owner_id = $2 WHERE id = $1`, [privateId, other.id])
      expect(JSON.parse(await tools.call('puc__read', { type: 'document', id: privateId })).error).toBeDefined()
      const disabled = app.get(PucToolsService).open(user.id, [])
      expect(JSON.parse(await disabled.call('puc__search', { query: title, type: 'documents' })).error).toBeDefined()
    } finally {
      rag.mockRestore()
    }
  })
})
