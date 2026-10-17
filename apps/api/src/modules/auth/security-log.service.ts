import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import type { Request } from 'express'
import type { LoginSession, SecurityEvent } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'

export type SecurityEventType =
  | 'login'
  | 'login_failed'
  | 'login_blocked'
  | 'logout'
  | 'register'
  | 'password_reset'
  | 'password_reset_requested'
  | 'email_verified'
  | 'session_revoked'

// Rút gọn User-Agent: "Chrome · macOS", "Safari · iPhone" (không cần thư viện)
export function describeDevice(ua: string | undefined): string {
  if (!ua) return 'Không rõ thiết bị'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /CriOS|Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Trình duyệt khác'
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Khác'
  return `${browser} · ${os}`
}

// IP thật: Nginx đặt từ CF-Connecting-IP (snippet pu-cloudflare-realip), Express trust proxy 1
export const clientIp = (req: Request) => (req.ip || '').replace(/^::ffff:/, '') || null

// Mã phiên công khai: băm sid (không lộ sid thật ra client)
export const publicSessionId = (sid: string) => createHash('sha256').update(sid).digest('hex').slice(0, 16)

const SESSION_USER = `sess::jsonb #>> '{passport,user,id}'`
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger(SecurityLogService.name)

  constructor(private readonly db: DatabaseService) {}

  // Ghi sự kiện — lỗi ghi log không được làm hỏng luồng đăng nhập
  async record(
    req: Request,
    event: SecurityEventType,
    opts: { userId?: string | null; success?: boolean; method?: 'password' | 'google' | null } = {}
  ): Promise<void> {
    const ua = String(req.headers['user-agent'] || '').slice(0, 300)
    await this.db
      .query(
        `INSERT INTO user_security_events (user_id, event, success, method, ip, user_agent, device)
         VALUES ($1, $2, $3, $4, $5::inet, $6, $7)`,
        [opts.userId ?? null, event, opts.success ?? true, opts.method ?? null, clientIp(req), ua || null, describeDevice(ua)]
      )
      .catch((err) => this.logger.warn(`record ${event}: ${err.message}`))
  }

  // Gắn thông tin thiết bị vào phiên vừa đăng nhập (hiện ở "Thiết bị đăng nhập")
  tagSession(req: Request, method: 'password' | 'google') {
    const ua = String(req.headers['user-agent'] || '')
    ;(req.session as unknown as { meta?: object }).meta = {
      ip: clientIp(req),
      device: describeDevice(ua),
      method,
      createdAt: new Date().toISOString()
    }
  }

  // Đăng nhập sai: chỉ gắn user_id khi tài khoản tồn tại (không lưu email/username người lạ)
  async recordFailedLogin(req: Request, identifier: string, blocked: boolean) {
    const res = await this.db
      .query(`SELECT id FROM users WHERE (email = $1 OR username = $1) AND account_type = 'human' LIMIT 1`, [identifier.toLowerCase().trim()])
      .catch(() => null)
    const userId = res?.rows[0]?.id
    if (!userId) return
    await this.record(req, blocked ? 'login_blocked' : 'login_failed', { userId, success: false, method: 'password' })
  }

  // ── Thiết bị đăng nhập của chính người dùng ──

  async listSessions(userId: string, currentSid: string): Promise<LoginSession[]> {
    const res = await this.db.query(
      `SELECT sid, sess::jsonb -> 'meta' AS meta, expire FROM user_sessions
       WHERE ${SESSION_USER} = $1 AND expire > NOW() ORDER BY expire DESC`,
      [userId]
    )
    return res.rows.map((r) => {
      const meta = (r.meta ?? {}) as { ip?: string; device?: string; method?: string; createdAt?: string }
      return {
        id: publicSessionId(r.sid),
        device: meta.device ?? 'Phiên cũ (trước khi có nhật ký)',
        ip: meta.ip ?? null,
        method: (meta.method as LoginSession['method']) ?? null,
        createdAt: meta.createdAt ?? null,
        // Phiên không rolling ⇒ expire cố định từ lúc tạo: expire − maxAge ≈ thời điểm đăng nhập
        lastActiveAt: new Date(new Date(r.expire).getTime() - SESSION_MAX_AGE_MS).toISOString(),
        current: r.sid === currentSid
      }
    })
  }

  // Đăng xuất 1 thiết bị (id công khai) hoặc mọi thiết bị khác
  async revokeSessions(req: Request, userId: string, target: { id?: string; others?: boolean }): Promise<number> {
    const res = await this.db.query(`SELECT sid FROM user_sessions WHERE ${SESSION_USER} = $1`, [userId])
    const sids = res.rows
      .map((r) => r.sid as string)
      .filter((sid) => sid !== req.sessionID && (target.others || publicSessionId(sid) === target.id))
    if (!sids.length) return 0
    await this.db.query(`DELETE FROM user_sessions WHERE sid = ANY($1::text[])`, [sids])
    await this.record(req, 'session_revoked', { userId })
    return sids.length
  }

  async listEvents(userId: string, limit = 30): Promise<SecurityEvent[]> {
    const res = await this.db.query(
      `SELECT id, event, success, method, host(ip) AS ip, device, created_at FROM user_security_events
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    )
    return res.rows.map((r) => ({
      id: String(r.id),
      event: r.event,
      success: r.success,
      method: r.method,
      ip: r.ip,
      device: r.device,
      createdAt: new Date(r.created_at).toISOString()
    }))
  }
}
