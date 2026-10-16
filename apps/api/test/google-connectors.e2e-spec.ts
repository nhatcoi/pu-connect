import type { NestExpressApplication } from '@nestjs/platform-express'
import type { DatabaseService } from '../src/database/database.service'
import { AiRetrieval } from '../src/modules/ai/ai.retrieval'
import { GoogleOAuthService } from '../src/modules/ai/connectors/google-oauth.service'
import { createTestApp, createUser, loginAgent } from './helpers'

// Luồng connector Google đầy đủ (connect → callback → đọc Drive / Calendar → refresh / thu hồi → ngắt)
// Google API được giả lập ở tầng fetch ⇒ chạy đúng code thật của GoogleOAuth/Drive/Calendar service
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const idToken = (email: string) => `x.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.y`
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('Google connectors (e2e, Google API giả lập)', () => {
  let app: NestExpressApplication
  let db: DatabaseService
  const realFetch = global.fetch
  const calls: string[] = []
  let tokenResponse: () => Response

  const ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'CONNECTOR_ENCRYPTION_KEY'] as const
  const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))

  beforeAll(async () => {
    Object.assign(process.env, {
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_CALLBACK_URL: 'https://puc.test/api/auth/google/callback',
      CONNECTOR_ENCRYPTION_KEY: 'test-key'
    })
    // Chỉ chặn request tới Google; còn lại (supertest) đi bình thường
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!/googleapis\.com|accounts\.google\.com/.test(url)) return realFetch(input, init)
      calls.push(`${init?.method ?? 'GET'} ${url.split('?')[0]}`)
      if (url.startsWith('https://oauth2.googleapis.com/token')) return tokenResponse()
      if (url.startsWith('https://oauth2.googleapis.com/revoke')) return json({})
      if (url.includes('/drive/v3/files?')) {
        expect(new URL(url).searchParams.get('q')).toContain("fullText contains 'đạo'")
        return json({ files: [{ id: 'd1', name: 'Giải tích - đạo hàm', mimeType: 'application/vnd.google-apps.document' }] })
      }
      if (url.includes('/drive/v3/files/d1/export')) return new Response('Đạo hàm của x^2 là 2x.')
      if (url.includes('/calendar/v3/calendars/primary/events')) {
        return json({ items: [{ id: 'e1', summary: 'Thi Giải tích 2', location: 'A2-301', start: { dateTime: '2026-10-20T07:30:00+07:00' } }] })
      }
      throw new Error(`unexpected ${url}`)
    }) as typeof fetch
    ;({ app, db } = await createTestApp())
  })
  afterAll(async () => {
    global.fetch = realFetch
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
    await app.close()
  })

  // connect ⇒ state trong session ⇒ callback đổi code
  async function connect(agent: Awaited<ReturnType<typeof loginAgent>>, slug: string, scope: string) {
    const start = await agent.get(`/api/ai/connectors/${slug}/connect`).expect(302)
    const auth = new URL(start.headers.location)
    expect(auth.origin).toBe('https://accounts.google.com')
    // Dùng lại redirect URI đăng nhập Google (đã khai báo trên Console)
    expect(auth.searchParams.get('redirect_uri')).toBe('https://puc.test/api/auth/google/callback')
    expect(auth.searchParams.get('scope')).toContain(scope)
    expect(auth.searchParams.get('access_type')).toBe('offline')
    tokenResponse = () =>
      json({ access_token: 'at', refresh_token: 'rt-secret', expires_in: 3600, scope: `openid email ${scope}`, id_token: idToken('sv@x.edu.vn') })
    return agent.get(`/api/auth/google/callback?code=c&state=${auth.searchParams.get('state')}`).expect(302)
  }

  it('Drive + Calendar: kết nối, token mã hóa, PU AI đọc được nguồn, thu hồi ⇒ tự ngắt, ngắt kết nối gọi revoke', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)

    const cb = await connect(agent, 'google-drive', DRIVE_SCOPE)
    expect(cb.headers.location).toBe('/puai/settings/connectors?connector=google-drive&result=connected')
    const row = await db.query(`SELECT refresh_token_enc, account_email FROM user_connectors WHERE user_id = $1 AND provider = 'google_drive'`, [user.id])
    expect(row.rows[0].account_email).toBe('sv@x.edu.vn')
    expect(row.rows[0].refresh_token_enc).not.toContain('rt-secret')

    await connect(agent, 'google-calendar', CAL_SCOPE)
    const list = (await agent.get('/api/ai/connectors').expect(200)).body.data
    expect(list.filter((c: { connected: boolean; requiresAuth: boolean }) => c.requiresAuth && c.connected)).toHaveLength(2)

    // PU AI truy xuất qua connector (access token từ lúc kết nối, không gọi lại /token)
    const retrieval = app.get(AiRetrieval)
    const sources = await retrieval.retrieve('Giải thích đạo hàm giúp mình', user.id, { connectors: ['google_drive', 'google_calendar'] })
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'drive', title: 'Giải tích - đạo hàm', body: 'Đạo hàm của x^2 là 2x.' }),
        expect.objectContaining({ type: 'calendar', body: expect.stringContaining('Thi Giải tích 2 @ A2-301') })
      ])
    )

    // Access token hết hạn + người dùng đã thu hồi ở Google ⇒ refresh lỗi invalid_grant ⇒ tự xóa kết nối Drive
    ;(app.get(GoogleOAuthService) as unknown as { tokens: Map<string, unknown> }).tokens.clear()
    tokenResponse = () => json({ error: 'invalid_grant' }, 400)
    expect(await retrieval.retrieve('đạo hàm', user.id, { connectors: ['google_drive'] })).toEqual([])
    const left = await db.query(`SELECT provider FROM user_connectors WHERE user_id = $1`, [user.id])
    expect(left.rows.map((r) => r.provider)).toEqual(['google_calendar'])

    // Ngắt Calendar ⇒ thu hồi phía Google bằng refresh token đã giải mã
    tokenResponse = () => json({ access_token: 'at2', expires_in: 3600 })
    calls.length = 0
    await agent.delete('/api/ai/connectors/google-calendar').expect(200)
    expect(calls).toContain('POST https://oauth2.googleapis.com/revoke')
    expect((await db.query(`SELECT 1 FROM user_connectors WHERE user_id = $1`, [user.id])).rows).toHaveLength(0)
  })

  it('callback đăng nhập Google không có phiên connector ⇒ middleware nhường cho passport', async () => {
    const res = await (await loginAgent(app, await createUser(db))).get('/api/auth/google/callback?code=c&state=login-state')
    expect(res.headers.location ?? '').not.toContain('connector=')
  })

  it('Google không cấp đúng scope ⇒ không lưu, báo lỗi', async () => {
    const user = await createUser(db)
    const agent = await loginAgent(app, user)
    const start = await agent.get('/api/ai/connectors/google-drive/connect').expect(302)
    const state = new URL(start.headers.location).searchParams.get('state')
    tokenResponse = () => json({ access_token: 'at', refresh_token: 'rt', scope: 'openid email' })
    const cb = await agent.get(`/api/auth/google/callback?code=c&state=${state}`).expect(302)
    expect(cb.headers.location).toBe('/puai/settings/connectors?connector=google-drive&result=error')
    expect((await db.query(`SELECT 1 FROM user_connectors WHERE user_id = $1`, [user.id])).rows).toHaveLength(0)
  })
})
