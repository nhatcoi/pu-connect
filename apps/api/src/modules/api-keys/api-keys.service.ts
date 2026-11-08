import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { DatabaseService } from '../../database/database.service'
import { API_KEY_MAX_PER_USER, API_KEY_PREFIX, API_KEY_SCOPES, type ApiKeyScope } from './api-key.scopes'

export interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface ApiKeyAuth {
  keyId: string
  userId: string
  scopes: string[]
}

const TOUCH_INTERVAL_MS = 60_000
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

@Injectable()
export class ApiKeysService {
  private readonly touched = new Map<string, number>()

  constructor(private readonly db: DatabaseService) {}

  async list(userId: string): Promise<ApiKeyItem[]> {
    const res = await this.db.query(
      `SELECT id, name, key_prefix, scopes, last_used_at, expires_at, created_at
       FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
      [userId]
    )
    return res.rows.map(toItem)
  }

  async create(userId: string, input: { name: string; scopes: string[]; expiresInDays?: number | null }): Promise<ApiKeyItem & { key: string }> {
    const scopes = [...new Set(input.scopes)].filter((s): s is ApiKeyScope => (API_KEY_SCOPES as readonly string[]).includes(s))
    if (scopes.length === 0) throw new BadRequestException('Chọn ít nhất một quyền cho key')
    const count = await this.db.query(`SELECT COUNT(*)::int AS n FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL`, [userId])
    if (count.rows[0].n >= API_KEY_MAX_PER_USER) throw new BadRequestException(`Tối đa ${API_KEY_MAX_PER_USER} key, hãy thu hồi key không dùng`)
    const key = API_KEY_PREFIX + randomBytes(32).toString('base64url')
    const days = input.expiresInDays && input.expiresInDays > 0 ? Math.min(input.expiresInDays, 365) : null
    const res = await this.db.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $6::int) END)
       RETURNING id, name, key_prefix, scopes, last_used_at, expires_at, created_at`,
      [userId, input.name.trim(), key.slice(0, 12), sha256(key), scopes, days]
    )
    return { ...toItem(res.rows[0]), key }
  }

  async revoke(userId: string, id: string): Promise<{ success: boolean }> {
    const res = await this.db.query(`UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, [id, userId])
    if (!res.rowCount) throw new NotFoundException('Không tìm thấy key')
    return { success: true }
  }

  // Trả null nếu key sai / thu hồi / hết hạn / chủ key bị khóa
  async authenticate(token: string): Promise<ApiKeyAuth | null> {
    if (!token.startsWith(API_KEY_PREFIX) || token.length > 128) return null
    const res = await this.db.query(
      `SELECT k.id, k.user_id, k.scopes FROM api_keys k JOIN users u ON u.id = k.user_id
       WHERE k.key_hash = $1 AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > NOW()) AND u.status <> 'suspended'`,
      [sha256(token)]
    )
    const row = res.rows[0]
    if (!row) return null
    const now = Date.now()
    if (now - (this.touched.get(row.id) ?? 0) > TOUCH_INTERVAL_MS) {
      this.touched.set(row.id, now)
      void this.db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => undefined)
    }
    return { keyId: row.id, userId: row.user_id, scopes: row.scopes }
  }
}

function toItem(r: any): ApiKeyItem {
  return {
    id: r.id,
    name: r.name,
    prefix: r.key_prefix,
    scopes: r.scopes,
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
    expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString()
  }
}
