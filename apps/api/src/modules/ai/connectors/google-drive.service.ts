import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'crypto'
import { DatabaseService } from '../../../database/database.service'
import { bufferToText, isExtractableMime } from '../doc-text'
import { TokenCipher } from './token-cipher'

const PROVIDER = 'google_drive'
const SCOPE = 'openid email https://www.googleapis.com/auth/drive.readonly'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const CALLBACK_PATH = '/api/ai/connectors/google-drive/callback'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_CHARS_PER_FILE = 2500
const TIMEOUT_MS = 10_000

// File Google (Docs/Sheets/Slides) ⇒ xuất văn bản
const EXPORT_MIME: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain'
}

export type DriveSource = { id: string; title: string; body: string }
type DriveFile = { id: string; name: string; mimeType: string; size?: string }

// Từ khóa giữ dấu (Drive fullText tự xử lý), ưu tiên từ dài
function keywords(question: string): string[] {
  const words = Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= 3)
    )
  )
  return words.sort((a, b) => b.length - a.length).slice(0, 4)
}

// Connector Google Drive: OAuth riêng (drive.readonly, không đụng đăng nhập), refresh token mã hóa,
// tìm fullText rồi đọc nội dung vài file liên quan cho PU AI
@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name)
  private readonly clientId?: string
  private readonly clientSecret?: string
  private readonly redirectUri?: string
  private readonly cipher: TokenCipher
  private readonly tokens = new Map<string, { value: string; expiresAt: number }>() // access token (bộ nhớ)

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') || undefined
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || undefined
    // Mặc định cùng origin với callback đăng nhập Google (khai báo thêm redirect URI này trên Google Console)
    const loginCallback = config.get<string>('GOOGLE_CALLBACK_URL')
    this.redirectUri = config.get<string>('GOOGLE_DRIVE_CALLBACK_URL') || (loginCallback ? new URL(CALLBACK_PATH, loginCallback).toString() : undefined)
    this.cipher = new TokenCipher(config.get<string>('CONNECTOR_ENCRYPTION_KEY') || config.get<string>('SESSION_SECRET') || 'dev-connector-key')
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri)
  }

  async isConnected(userId: string): Promise<boolean> {
    const res = await this.db.query(`SELECT 1 FROM user_connectors WHERE user_id = $1 AND provider = $2`, [userId, PROVIDER])
    return res.rows.length > 0
  }

  // URL màn đồng ý của Google + state chống CSRF (lưu session)
  authorizeUrl(): { url: string; state: string } {
    if (!this.isConfigured()) throw new BadRequestException('Google Drive chưa được cấu hình')
    const state = randomBytes(24).toString('base64url')
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent', // luôn nhận refresh token
      include_granted_scopes: 'true',
      state
    })
    return { url: `${AUTH_URL}?${params}`, state }
  }

  // Đổi code lấy token, lưu refresh token đã mã hóa
  async connect(userId: string, code: string): Promise<void> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.redirectUri!,
        grant_type: 'authorization_code'
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string }
    if (!res.ok || !body.refresh_token || !body.scope?.includes('drive.readonly')) throw new BadRequestException('Không nhận được quyền đọc Google Drive')
    await this.db.query(
      `INSERT INTO user_connectors (user_id, provider, refresh_token_enc, account_email, scope) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, provider) DO UPDATE SET refresh_token_enc = EXCLUDED.refresh_token_enc, account_email = EXCLUDED.account_email,
         scope = EXCLUDED.scope, updated_at = NOW()`,
      [userId, PROVIDER, this.cipher.encrypt(body.refresh_token), emailFromIdToken(body.id_token), body.scope]
    )
    if (body.access_token) this.tokens.set(userId, { value: body.access_token, expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 })
  }

  // Ngắt kết nối: xóa token ở DB + thu hồi phía Google (best-effort)
  async disconnect(userId: string): Promise<void> {
    const res = await this.db.query(`DELETE FROM user_connectors WHERE user_id = $1 AND provider = $2 RETURNING refresh_token_enc`, [userId, PROVIDER])
    this.tokens.delete(userId)
    const enc = res.rows[0]?.refresh_token_enc
    if (enc) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(this.cipher.decrypt(enc))}`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS)
      }).catch(() => undefined)
    }
  }

  // Tìm file liên quan câu hỏi rồi đọc nội dung (song song); lỗi ⇒ [] (không làm hỏng câu trả lời)
  async search(userId: string, question: string, limit: number): Promise<DriveSource[]> {
    const words = keywords(question)
    if (!words.length) return []
    const token = await this.accessToken(userId)
    if (!token) return []
    const q = `trashed = false and (${words.map((w) => `fullText contains '${w.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(' or ')})`
    const params = new URLSearchParams({ q, pageSize: String(limit), fields: 'files(id,name,mimeType,size)', spaces: 'drive' })
    const res = await this.get(`${DRIVE_API}?${params}`, token)
    const files = ((await res.json()) as { files?: DriveFile[] }).files ?? []
    const read = await Promise.all(files.map((f) => this.readFile(f, token).catch(() => null)))
    return read.filter((s): s is DriveSource => !!s?.body)
  }

  private async readFile(f: DriveFile, token: string): Promise<DriveSource | null> {
    let text: string
    const exportMime = EXPORT_MIME[f.mimeType]
    if (exportMime) {
      text = await (await this.get(`${DRIVE_API}/${f.id}/export?mimeType=${encodeURIComponent(exportMime)}`, token)).text()
    } else if (isExtractableMime(f.mimeType) && Number(f.size ?? 0) <= MAX_FILE_BYTES) {
      const buf = Buffer.from(await (await this.get(`${DRIVE_API}/${f.id}?alt=media`, token)).arrayBuffer())
      text = await bufferToText(buf, f.mimeType)
    } else {
      return null
    }
    return { id: f.id, title: f.name, body: text.slice(0, MAX_CHARS_PER_FILE).trim() }
  }

  private async get(url: string, token: string): Promise<Response> {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Drive HTTP ${res.status}`)
    return res
  }

  // Access token từ cache, hết hạn ⇒ làm mới bằng refresh token; bị thu hồi ⇒ xóa kết nối
  private async accessToken(userId: string): Promise<string | null> {
    const cached = this.tokens.get(userId)
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const row = await this.db.query(`SELECT refresh_token_enc FROM user_connectors WHERE user_id = $1 AND provider = $2`, [userId, PROVIDER])
    if (!row.rows[0] || !this.isConfigured()) return null
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        refresh_token: this.cipher.decrypt(row.rows[0].refresh_token_enc),
        grant_type: 'refresh_token'
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string }
    if (!res.ok || !body.access_token) {
      if (body.error === 'invalid_grant') {
        this.logger.warn(`Google Drive token bị thu hồi (user ${userId}) ⇒ ngắt kết nối`)
        await this.db.query(`DELETE FROM user_connectors WHERE user_id = $1 AND provider = $2`, [userId, PROVIDER])
      }
      return null
    }
    this.tokens.set(userId, { value: body.access_token, expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 })
    return body.access_token
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
