import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { DatabaseService } from '../../database/database.service'
import { ADMIN_KEY_MAX_DAYS, ADMIN_KEY_PREFIX, ADMIN_KEY_SCOPES, API_KEY_MAX_PER_USER, API_KEY_PREFIX, API_KEY_SCOPES, type ApiKeyKind } from './api-key.scopes'

export interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
  ipAllow?: string[] | null
}

export interface ApiKeyAuth {
  keyId: string
  userId: string
  scopes: string[]
  kind: ApiKeyKind
  ipAllow: string[] | null
}

const TOUCH_INTERVAL_MS = 60_000
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

@Injectable()
export class ApiKeysService {
  private readonly touched = new Map<string, number>()

  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, kind: ApiKeyKind = 'user'): Promise<ApiKeyItem[]> {
    const res = await this.db.query(
      `SELECT id, name, key_prefix, scopes, last_used_at, expires_at, created_at, ip_allow
       FROM api_keys WHERE user_id = $1 AND kind = $2 AND revoked_at IS NULL ORDER BY created_at DESC`,
      [userId, kind]
    )
    return res.rows.map(toItem)
  }

  async create(
    userId: string,
    input: { name: string; scopes: string[]; expiresInDays?: number | null; ipAllow?: string[] | null },
    kind: ApiKeyKind = 'user'
  ): Promise<ApiKeyItem & { key: string }> {
    const allowed: readonly string[] = kind === 'admin' ? ADMIN_KEY_SCOPES : API_KEY_SCOPES
    const scopes = [...new Set(input.scopes)].filter((s) => allowed.includes(s))
    if (scopes.length === 0) throw new BadRequestException('Chọn ít nhất một quyền cho key')
    const count = await this.db.query(`SELECT COUNT(*)::int AS n FROM api_keys WHERE user_id = $1 AND kind = $2 AND revoked_at IS NULL`, [userId, kind])
    if (count.rows[0].n >= API_KEY_MAX_PER_USER) throw new BadRequestException(`Tối đa ${API_KEY_MAX_PER_USER} key, hãy thu hồi key không dùng`)
    const key = (kind === 'admin' ? ADMIN_KEY_PREFIX : API_KEY_PREFIX) + randomBytes(32).toString('base64url')
    // Key admin luôn có hạn (mặc định và tối đa 30 ngày)
    const requested = input.expiresInDays && input.expiresInDays > 0 ? Math.min(input.expiresInDays, 365) : null
    const days = kind === 'admin' ? Math.min(requested ?? ADMIN_KEY_MAX_DAYS, ADMIN_KEY_MAX_DAYS) : requested
    const ips = input.ipAllow?.map((i) => i.trim()).filter(Boolean)
    const res = await this.db.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at, kind, ip_allow)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $6::int) END, $7, $8)
       RETURNING id, name, key_prefix, scopes, last_used_at, expires_at, created_at, ip_allow`,
      [userId, input.name.trim(), key.slice(0, 12), sha256(key), scopes, days, kind, ips?.length ? ips : null]
    )
    return { ...toItem(res.rows[0]), key }
  }

  // Nhật ký lời gọi bằng key (không lưu nội dung request)
  logCall(e: { keyId: string; userId: string; method: string; path: string; status: number; ip: string | null }) {
    void this.db
      .query(`INSERT INTO api_key_logs (key_id, user_id, method, path, status, ip) VALUES ($1, $2, $3, $4, $5, $6)`, [e.keyId, e.userId, e.method, e.path.slice(0, 300), e.status, e.ip])
      .catch(() => undefined)
  }

  async logs(userId: string, kind: ApiKeyKind, limit = 100) {
    const res = await this.db.query(
      `SELECT l.id, l.key_id, k.name AS key_name, l.method, l.path, l.status, l.ip, l.created_at
       FROM api_key_logs l JOIN api_keys k ON k.id = l.key_id
       WHERE k.kind = $1 AND ($1 = 'admin' OR l.user_id = $2)
       ORDER BY l.created_at DESC LIMIT $3`,
      [kind, userId, Math.min(200, limit)]
    )
    return res.rows.map((r) => ({ id: String(r.id), keyId: r.key_id, keyName: r.key_name, method: r.method, path: r.path, status: r.status, ip: r.ip, createdAt: new Date(r.created_at).toISOString() }))
  }

  async revoke(userId: string, id: string): Promise<{ success: boolean }> {
    const res = await this.db.query(`UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, [id, userId])
    if (!res.rowCount) throw new NotFoundException('Không tìm thấy key')
    return { success: true }
  }

  // Trả null nếu key sai / thu hồi / hết hạn / chủ key bị khóa
  async authenticate(token: string): Promise<ApiKeyAuth | null> {
    if (!(token.startsWith(API_KEY_PREFIX) || token.startsWith(ADMIN_KEY_PREFIX)) || token.length > 128) return null
    const res = await this.db.query(
      `SELECT k.id, k.user_id, k.scopes, k.kind, k.ip_allow FROM api_keys k JOIN users u ON u.id = k.user_id
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
    return { keyId: row.id, userId: row.user_id, scopes: row.scopes, kind: row.kind, ipAllow: row.ip_allow }
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
    createdAt: new Date(r.created_at).toISOString(),
    ipAllow: r.ip_allow ?? null
  }
}
