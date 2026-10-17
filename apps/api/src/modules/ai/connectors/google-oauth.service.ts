import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'crypto'
import { DatabaseService } from '../../../database/database.service'
import { TokenCipher } from './token-cipher'

// Connector Google của N7AI: mỗi provider 1 scope chỉ đọc, chung 1 OAuth client & 1 callback URI
export const GOOGLE_PROVIDERS = {
  google_drive: { slug: 'google-drive', scope: 'https://www.googleapis.com/auth/drive.readonly' },
  google_calendar: { slug: 'google-calendar', scope: 'https://www.googleapis.com/auth/calendar.readonly' }
} as const
export type GoogleProvider = keyof typeof GOOGLE_PROVIDERS

export const providerFromSlug = (slug: string): GoogleProvider | null =>
  (Object.keys(GOOGLE_PROVIDERS) as GoogleProvider[]).find((p) => GOOGLE_PROVIDERS[p].slug === slug) ?? null

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const TIMEOUT_MS = 10_000

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string; error?: string }

// OAuth redirect flow (state chống CSRF), refresh token mã hóa AES-256-GCM trong user_connectors,
// access token cache trong bộ nhớ; token bị thu hồi (invalid_grant) ⇒ tự xóa kết nối
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name)
  private readonly clientId?: string
  private readonly clientSecret?: string
  private readonly redirectUri?: string
  private readonly cipher: TokenCipher
  private readonly tokens = new Map<string, { value: string; expiresAt: number }>() // `${provider}:${userId}`

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') || undefined
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || undefined
    // Mặc định dùng lại redirect URI của đăng nhập Google (đã khai báo) ⇒ ConnectorCallbackMiddleware nhận theo state
    this.redirectUri = config.get<string>('GOOGLE_CONNECTOR_CALLBACK_URL') || config.get<string>('GOOGLE_CALLBACK_URL') || undefined
    this.cipher = new TokenCipher(config.get<string>('CONNECTOR_ENCRYPTION_KEY') || config.get<string>('SESSION_SECRET') || 'dev-connector-key')
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri)
  }

  // URL màn đồng ý + state (lưu session) cho 1 provider
  authorizeUrl(provider: GoogleProvider): { url: string; state: string } {
    if (!this.isConfigured()) throw new BadRequestException('Kết nối Google chưa được cấu hình')
    const state = randomBytes(24).toString('base64url')
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      response_type: 'code',
      scope: `openid email ${GOOGLE_PROVIDERS[provider].scope}`,
      access_type: 'offline',
      prompt: 'consent', // luôn nhận refresh token
      state
    })
    return { url: `${AUTH_URL}?${params}`, state }
  }

  // Đổi code lấy token; phải được cấp đúng scope của provider
  async connect(userId: string, provider: GoogleProvider, code: string): Promise<void> {
    const body = await this.tokenRequest({ code, redirect_uri: this.redirectUri!, grant_type: 'authorization_code' })
    if (!body.refresh_token || !body.scope?.split(' ').includes(GOOGLE_PROVIDERS[provider].scope)) {
      throw new BadRequestException('Không nhận được quyền truy cập cần thiết')
    }
    await this.db.query(
      `INSERT INTO user_connectors (user_id, provider, refresh_token_enc, account_email, scope) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, provider) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc, account_email = EXCLUDED.account_email,
         scope = EXCLUDED.scope, updated_at = NOW()`,
      [userId, provider, this.cipher.encrypt(body.refresh_token), emailFromIdToken(body.id_token), body.scope]
    )
    if (body.access_token) this.cache(userId, provider, body)
  }

  // Ngắt kết nối: xóa DB + thu hồi phía Google (best-effort)
  async disconnect(userId: string, provider: GoogleProvider): Promise<void> {
    const res = await this.db.query(`DELETE FROM user_connectors WHERE user_id = $1 AND provider = $2 RETURNING refresh_token_enc`, [userId, provider])
    this.tokens.delete(`${provider}:${userId}`)
    const enc = res.rows[0]?.refresh_token_enc
    if (enc) {
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(this.cipher.decrypt(enc))}`, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(
        () => undefined
      )
    }
  }

  // Access token còn hạn (cache) hoặc làm mới bằng refresh token; chưa kết nối ⇒ null
  async accessToken(userId: string, provider: GoogleProvider): Promise<string | null> {
    const cached = this.tokens.get(`${provider}:${userId}`)
    if (cached && cached.expiresAt > Date.now()) return cached.value
    if (!this.isConfigured()) return null
    const row = await this.db.query(`SELECT refresh_token_enc FROM user_connectors WHERE user_id = $1 AND provider = $2`, [userId, provider])
    if (!row.rows[0]) return null
    const body = await this.tokenRequest({ refresh_token: this.cipher.decrypt(row.rows[0].refresh_token_enc), grant_type: 'refresh_token' }).catch(
      (err: TokenResponse) => err
    )
    if (!body.access_token) {
      if (body.error === 'invalid_grant') {
        this.logger.warn(`Token ${provider} bị thu hồi (user ${userId}) ⇒ ngắt kết nối`)
        await this.db.query(`DELETE FROM user_connectors WHERE user_id = $1 AND provider = $2`, [userId, provider])
      }
      return null
    }
    return this.cache(userId, provider, body)
  }

  // GET Google API có Bearer token (lỗi HTTP ⇒ throw, nơi gọi tự bỏ qua nguồn)
  async get(url: string, token: string): Promise<Response> {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Google API HTTP ${res.status}`)
    return res
  }

  private async tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId!, client_secret: this.clientSecret!, ...params }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    const body = (await res.json()) as TokenResponse
    if (!res.ok) throw body
    return body
  }

  private cache(userId: string, provider: GoogleProvider, body: TokenResponse): string {
    this.tokens.set(`${provider}:${userId}`, { value: body.access_token!, expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 })
    return body.access_token!
  }
}

// id_token nhận trực tiếp từ Google qua TLS ⇒ đọc payload, không cần xác minh chữ ký
function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    return JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8')).email ?? null
  } catch {
    return null
  }
}
