import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'
import { DatabaseService } from '../../../database/database.service'
import { TokenCipher } from './token-cipher'

export interface PuConnectorPending {
  state: string
  verifier: string
  userId: string
  expiresAt: number
}
const tokenSchema = z.object({ access_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), account: z.string().min(1).max(255) })
const PROVIDER = 'pu_connector'

// PUC stores a scoped grant; the extension's university SSO is handled only by PKA.
@Injectable()
export class PuConnectorService {
  readonly origin: string
  private readonly callback: string
  private readonly cipher: TokenCipher

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    const url = new URL(config.get<string>('PKA_CONNECTOR_URL') || 'https://pka.vnhat.dev')
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('PKA_CONNECTOR_URL must use HTTPS')
    this.origin = url.origin
    this.callback = `${(config.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/+$/, '')}/api/ai/connectors/pu-connector/callback`
    const secret = config.get<string>('CONNECTOR_ENCRYPTION_KEY') || config.get<string>('SESSION_SECRET')
    if (!secret && config.get<string>('NODE_ENV') === 'production') throw new Error('Connector encryption requires SESSION_SECRET')
    this.cipher = new TokenCipher(secret || 'dev-connector-key')
  }

  begin(userId: string) {
    const pending: PuConnectorPending = {
      state: randomBytes(32).toString('base64url'),
      verifier: randomBytes(32).toString('base64url'),
      userId,
      expiresAt: Date.now() + 10 * 60_000
    }
    const url = new URL('/connect/', this.origin)
    url.search = new URLSearchParams({
      state: pending.state,
      code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
      redirect_uri: this.callback
    }).toString()
    return { pending, url: url.href }
  }

  async complete(userId: string, pending: PuConnectorPending, state: unknown, code: unknown) {
    if (
      pending.userId !== userId ||
      pending.expiresAt <= Date.now() ||
      state !== pending.state ||
      typeof code !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(code)
    )
      throw new BadRequestException('Phiên kết nối đã hết hạn')
    const previous = await this.token(userId)
    const response = await this.request('/token', { code, code_verifier: pending.verifier, redirect_uri: this.callback })
    const token = tokenSchema.parse(await response.json())
    try {
      await this.db.transaction(async (client) => {
        await client.query(
          `INSERT INTO user_connectors (user_id, provider, refresh_token_enc, account_email, scope) VALUES ($1, $2, $3, $4, 'academic.read')
         ON CONFLICT (user_id, provider) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc, account_email = EXCLUDED.account_email,
         scope = EXCLUDED.scope, last_error = NULL, last_used_at = NULL, updated_at = NOW()`,
          [userId, PROVIDER, this.cipher.encrypt(token.access_token), token.account]
        )
        await client.query(
          `INSERT INTO ai_settings (user_id, default_connectors) VALUES ($1, ARRAY['library','web','my_study','my_chats','pu_connector'])
         ON CONFLICT (user_id) DO UPDATE SET default_connectors = CASE WHEN 'pu_connector' = ANY(ai_settings.default_connectors)
           THEN ai_settings.default_connectors ELSE array_append(ai_settings.default_connectors, 'pu_connector') END`,
          [userId]
        )
      })
    } catch (error) {
      await this.request('/revoke', {}, token.access_token).catch(() => undefined)
      throw error
    }
    if (previous && previous !== token.access_token) await this.request('/revoke', {}, previous).catch(() => undefined)
  }

  async token(userId: string): Promise<string | null> {
    const row = await this.db.query('SELECT refresh_token_enc FROM user_connectors WHERE user_id = $1 AND provider = $2', [userId, PROVIDER])
    return row.rows[0] ? this.cipher.decrypt(row.rows[0].refresh_token_enc) : null
  }

  async disconnect(userId: string) {
    const token = await this.token(userId)
    if (token) await this.request('/revoke', {}, token)
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM user_connectors WHERE user_id = $1 AND provider = $2', [userId, PROVIDER])
      await client.query("UPDATE ai_settings SET default_connectors = array_remove(default_connectors, 'pu_connector') WHERE user_id = $1", [userId])
    })
  }

  async record(userId: string, error: string | null) {
    await this.db.query(
      'UPDATE user_connectors SET last_error = $3::text, last_used_at = CASE WHEN $3::text IS NULL THEN NOW() ELSE last_used_at END WHERE user_id = $1 AND provider = $2',
      [userId, PROVIDER, error]
    )
  }

  private async request(path: string, data: Record<string, string>, token?: string) {
    const response = await fetch(`${this.origin}/api/ai/pu-connector${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error'
    }).catch(() => {
      throw new ServiceUnavailableException('Chưa kết nối được PKA. Thử lại nhé.')
    })
    if (!response.ok) throw new BadRequestException('Kết nối PKA đã hết hạn. Hãy kết nối lại.')
    return response
  }
}
