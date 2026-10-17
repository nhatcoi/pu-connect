import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'

// IP có quá nhiều tài khoản ⇒ thường là NAT / wifi trường, không coi là dấu hiệu clone
export const SHARED_IP_MAX_ACCOUNTS = 10
const RECOMPUTE_MS = 10 * 60_000

/**
 * Điểm rủi ro 0–100 cho mỗi tài khoản (càng cao càng cần xem xét), tính lại mỗi 10 phút:
 *  - Bị báo cáo trong 30 ngày        8 điểm / lượt   (tối đa 30)
 *  - Bài bị ẩn trong 90 ngày         15 điểm / bài   (tối đa 30)
 *  - Bị xử phạt trong 180 ngày       15 điểm / lần   (tối đa 30)
 *  - Tài khoản < 7 ngày đăng ≥ 10 bài/bình luận trong 24h      15 điểm
 *  - Đăng nhập chung IP với 1–9 tài khoản khác (30 ngày)       10 + 5 / tài khoản (tối đa 25)
 *  - Đăng nhập sai ≥ 5 lần trong 24h                           10 điểm
 * Cùng job: xóa nhật ký bảo mật quá 90 ngày.
 */
const RISK_SQL = `
WITH h AS (SELECT id, created_at FROM users WHERE account_type = 'human'),
rep AS (
  SELECT p.author_id AS uid, COUNT(*)::int AS n FROM post_reports r JOIN posts p ON p.id = r.post_id
  WHERE r.created_at > NOW() - INTERVAL '30 days' GROUP BY 1
),
hid AS (SELECT author_id AS uid, COUNT(*)::int AS n FROM posts WHERE hidden_at > NOW() - INTERVAL '90 days' GROUP BY 1),
san AS (
  SELECT user_id AS uid, COUNT(*)::int AS n FROM user_sanctions
  WHERE revoked_at IS NULL AND created_at > NOW() - INTERVAL '180 days' GROUP BY 1
),
burst AS (
  SELECT h.id AS uid,
    (SELECT COUNT(*) FROM posts p WHERE p.author_id = h.id AND p.created_at > NOW() - INTERVAL '24 hours')
    + (SELECT COUNT(*) FROM comments c WHERE c.author_id = h.id AND c.created_at > NOW() - INTERVAL '24 hours') AS n
  FROM h WHERE h.created_at > NOW() - INTERVAL '7 days'
),
ip_users AS (
  SELECT DISTINCT ip, user_id FROM user_security_events
  WHERE ip IS NOT NULL AND user_id IS NOT NULL AND success AND event IN ('login', 'register')
    AND created_at > NOW() - INTERVAL '30 days'
),
small_ips AS (SELECT ip FROM ip_users GROUP BY ip HAVING COUNT(*) BETWEEN 2 AND ${SHARED_IP_MAX_ACCOUNTS}),
shared AS (
  SELECT a.user_id AS uid, COUNT(DISTINCT b.user_id)::int AS n
  FROM ip_users a JOIN small_ips s ON s.ip = a.ip JOIN ip_users b ON b.ip = a.ip AND b.user_id <> a.user_id
  GROUP BY 1
),
fail AS (
  SELECT user_id AS uid, COUNT(*)::int AS n FROM user_security_events
  WHERE NOT success AND created_at > NOW() - INTERVAL '24 hours' AND user_id IS NOT NULL GROUP BY 1
),
f AS (
  SELECT h.id, array_remove(ARRAY[
    CASE WHEN rep.n > 0 THEN jsonb_build_object('key', 'reports', 'label', rep.n || ' lượt bị báo cáo (30 ngày)', 'points', LEAST(30, rep.n * 8)) END,
    CASE WHEN hid.n > 0 THEN jsonb_build_object('key', 'hidden', 'label', hid.n || ' bài bị ẩn (90 ngày)', 'points', LEAST(30, hid.n * 15)) END,
    CASE WHEN san.n > 0 THEN jsonb_build_object('key', 'sanctions', 'label', san.n || ' lần bị xử phạt (180 ngày)', 'points', LEAST(30, san.n * 15)) END,
    CASE WHEN burst.n >= 10 THEN jsonb_build_object('key', 'burst', 'label', 'Tài khoản mới đăng ' || burst.n || ' nội dung / 24h', 'points', 15) END,
    CASE WHEN shared.n > 0 THEN jsonb_build_object('key', 'shared_ip', 'label', 'Chung IP với ' || shared.n || ' tài khoản khác', 'points', LEAST(25, 5 + shared.n * 5)) END,
    CASE WHEN fail.n >= 5 THEN jsonb_build_object('key', 'failed_logins', 'label', 'Đăng nhập sai ' || fail.n || ' lần / 24h', 'points', 10) END
  ], NULL) AS factors
  FROM h
  LEFT JOIN rep ON rep.uid = h.id LEFT JOIN hid ON hid.uid = h.id LEFT JOIN san ON san.uid = h.id
  LEFT JOIN burst ON burst.uid = h.id LEFT JOIN shared ON shared.uid = h.id LEFT JOIN fail ON fail.uid = h.id
),
c AS (
  SELECT id, to_jsonb(factors) AS factors,
    LEAST(100, COALESCE((SELECT SUM((x ->> 'points')::int) FROM unnest(factors) x), 0))::smallint AS score
  FROM f
)
UPDATE users u SET risk_score = c.score, risk_factors = c.factors, risk_updated_at = NOW()
FROM c WHERE u.id = c.id AND (u.risk_score <> c.score OR u.risk_factors <> c.factors)`

@Injectable()
export class AdminRiskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminRiskService.name)
  private timer?: NodeJS.Timeout
  private running = false

  constructor(private readonly db: DatabaseService) {}

  // Tính lại điểm rủi ro (chỉ ghi dòng thay đổi) + dọn nhật ký bảo mật cũ
  async recompute(): Promise<{ updated: number; purged: number }> {
    if (this.running) return { updated: 0, purged: 0 }
    this.running = true
    try {
      const res = await this.db.query(RISK_SQL)
      const purge = await this.db.query(`DELETE FROM user_security_events WHERE created_at < NOW() - INTERVAL '90 days'`)
      const views = await this.db.query(`DELETE FROM profile_views WHERE last_at < NOW() - INTERVAL '90 days'`)
      return { updated: res.rowCount ?? 0, purged: (purge.rowCount ?? 0) + (views.rowCount ?? 0) }
    } finally {
      this.running = false
    }
  }

  onModuleInit() {
    const run = () => this.recompute().catch((err) => this.logger.warn(`recompute: ${(err as Error).message}`))
    setTimeout(run, 20_000).unref()
    this.timer = setInterval(run, RECOMPUTE_MS)
    this.timer.unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }
}
