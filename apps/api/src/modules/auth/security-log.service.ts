import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import type { Request } from 'express'
import type { LoginSession, SecurityEvent } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { NotificationsService } from '../notifications/notifications.service'

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

export interface GeoLocation {
  country: string | null
  region: string | null
  city: string | null
}

// Vị trí gần đúng từ header Cloudflare (Managed Transform "Add visitor location headers")
export function visitorLocation(req: Request): GeoLocation {
  const h = (name: string) => {
    const raw = req.headers[name]
    const v = (Array.isArray(raw) ? raw[0] : raw)?.trim()
    if (!v) return null
    try {
      return decodeURIComponent(v).slice(0, 80)
    } catch {
      return v.slice(0, 80)
    }
  }
  const country = h('cf-ipcountry')?.toUpperCase() ?? null
  // XX = không xác định, T1 = mạng Tor
  return {
    country: country && /^[A-Z][A-Z0-9]$/.test(country) && country !== 'XX' ? country : null,
    region: h('cf-region'),
    city: h('cf-ipcity')
  }
}

// "Hà Nội, VN" — dùng cho nhãn ngắn trong phiên / thông báo
export const formatLocation = (g: GeoLocation) => [g.city || g.region, g.country].filter(Boolean).join(', ') || null

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger(SecurityLogService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService
  ) {}

  // Ghi sự kiện — lỗi ghi log không được làm hỏng luồng đăng nhập
  async record(
    req: Request,
    event: SecurityEventType,
    opts: { userId?: string | null; success?: boolean; method?: 'password' | 'google' | null } = {}
  ): Promise<void> {
    const ua = String(req.headers['user-agent'] || '').slice(0, 300)
    const geo = visitorLocation(req)
    const device = describeDevice(ua)
    try {
      // Đăng nhập thành công từ quốc gia / vùng chưa từng thấy (90 ngày) ⇒ "nơi lạ"
      // Lần đăng nhập đầu tiên hoặc thiếu vị trí ⇒ không đánh dấu
      const res = await this.db.query(
        `INSERT INTO user_security_events (user_id, event, success, method, ip, user_agent, device, country, region, city, unusual)
         VALUES ($1::uuid, $2::text, $3::boolean, $4::text, $5::inet, $6::text, $7::text, $8::text, $9::text, $10::text,
           $2::text = 'login' AND $3::boolean AND $1::uuid IS NOT NULL AND $8::text IS NOT NULL
           AND EXISTS (SELECT 1 FROM user_security_events p WHERE p.user_id = $1::uuid AND p.event IN ('login', 'register') AND p.success AND p.country IS NOT NULL)
           AND NOT EXISTS (
             SELECT 1 FROM user_security_events p
             WHERE p.user_id = $1::uuid AND p.event IN ('login', 'register') AND p.success AND p.country = $8::text
               AND p.region IS NOT DISTINCT FROM $9::text AND p.created_at > NOW() - INTERVAL '90 days'
           ))
         RETURNING unusual`,
        [opts.userId ?? null, event, opts.success ?? true, opts.method ?? null, clientIp(req), ua || null, device, geo.country, geo.region, geo.city]
      )
      if (res.rows[0]?.unusual && opts.userId) {
        // Báo chính người dùng: không phải mình thì đổi mật khẩu + đăng xuất thiết bị khác
        await this.notifications
          .notify({
            type: 'account_notice',
            recipientId: opts.userId,
            actorId: null,
            verb: `Có đăng nhập mới từ ${formatLocation(geo)} (${device})`,
            message: 'Nếu không phải bạn, hãy đổi mật khẩu và đăng xuất các thiết bị khác trong Cài đặt › Đăng nhập & Bảo mật.',
            link: '/settings/security'
          })
          .catch(() => undefined)
      }
    } catch (err) {
      this.logger.warn(`record ${event}: ${(err as Error).message}`)
    }
  }

  // Gắn thông tin thiết bị vào phiên vừa đăng nhập (hiện ở "Thiết bị đăng nhập")
  tagSession(req: Request, method: 'password' | 'google') {
    const ua = String(req.headers['user-agent'] || '')
    ;(req.session as unknown as { meta?: object }).meta = {
      ip: clientIp(req),
      device: describeDevice(ua),
      location: formatLocation(visitorLocation(req)),
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
      const meta = (r.meta ?? {}) as { ip?: string; device?: string; location?: string; method?: string; createdAt?: string }
      return {
        id: publicSessionId(r.sid),
        device: meta.device ?? 'Phiên cũ (trước khi có nhật ký)',
        ip: meta.ip ?? null,
        location: meta.location ?? null,
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
      `SELECT id, event, success, method, host(ip) AS ip, device, country, region, city, unusual, created_at FROM user_security_events
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
      location: formatLocation(r),
      country: r.country,
      unusual: r.unusual,
      createdAt: new Date(r.created_at).toISOString()
    }))
  }
}
