import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { AdminAnnouncement, AdminAnnouncementBanner } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { writeAudit } from '../admin-audit'
import type { AnnouncementAudience, AnnouncementCreate } from './announcements.dto'

const TICK_MS = 30_000
const MAX_SCHEDULE_DAYS = 365

// Người dùng u khớp đối tượng a.audience (JSONB): rỗng = mọi người; trường / lĩnh vực quan tâm chọn theo id
const MATCH = `
  u.account_type = 'human' AND u.status = 'active'
  AND (COALESCE(jsonb_array_length(a.audience->'roles'), 0) = 0
       OR u.role::text IN (SELECT jsonb_array_elements_text(a.audience->'roles')))
  AND (COALESCE(jsonb_array_length(a.audience->'universityIds'), 0) = 0
       OR u.university_id::text IN (SELECT jsonb_array_elements_text(a.audience->'universityIds')))
  AND (COALESCE(jsonb_array_length(a.audience->'fieldIds'), 0) = 0
       OR EXISTS (SELECT 1 FROM user_interest_fields uf WHERE uf.user_id = u.id AND uf.field_id::text IN (SELECT jsonb_array_elements_text(a.audience->'fieldIds'))))`

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

@Injectable()
export class AnnouncementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnnouncementsService.name)
  private timer: NodeJS.Timeout | null = null
  private busy = false

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.deliverDue(), TICK_MS)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async list(status?: string): Promise<AdminAnnouncement[]> {
    const res = await this.db.query(
      `SELECT a.*, u.username AS creator FROM announcements a LEFT JOIN users u ON u.id = a.created_by
       WHERE ($1::text IS NULL OR a.status = $1) ORDER BY a.scheduled_at DESC LIMIT 100`,
      [status ?? null]
    )
    return res.rows.map(
      (r): AdminAnnouncement => ({
        id: r.id,
        title: r.title,
        message: r.message,
        link: r.link,
        audience: r.audience ?? {},
        sendInApp: r.send_in_app,
        banner: r.banner,
        bannerUntil: iso(r.banner_until),
        status: r.status,
        scheduledAt: iso(r.scheduled_at) as string,
        sentAt: iso(r.sent_at),
        recipientsCount: r.recipients_count,
        createdBy: r.creator,
        createdAt: iso(r.created_at) as string
      })
    )
  }

  // Số người sẽ nhận với đối tượng này (xem trước khi gửi)
  async preview(audience: AnnouncementAudience): Promise<{ count: number }> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM (SELECT $1::jsonb AS audience) a JOIN users u ON TRUE WHERE ${MATCH}`,
      [JSON.stringify(audience)]
    )
    return { count: res.rows[0].n }
  }

  async create(adminId: string, input: AnnouncementCreate): Promise<{ id: string; scheduledAt: string }> {
    const now = Date.now()
    const at = input.scheduledAt ? new Date(input.scheduledAt) : new Date(now)
    if (at.getTime() > now + MAX_SCHEDULE_DAYS * 86_400_000) throw new BadRequestException('Chỉ hẹn giờ tối đa 1 năm')
    if (input.banner && input.bannerUntil && new Date(input.bannerUntil).getTime() <= at.getTime()) {
      throw new BadRequestException('Hạn banner phải sau giờ gửi')
    }
    const id = await this.db.transaction(async (client) => {
      const res = await client.query(
        `INSERT INTO announcements (title, message, link, audience, send_in_app, banner, banner_until, scheduled_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [input.title, input.message, input.link || null, JSON.stringify(input.audience), input.sendInApp, input.banner, input.banner ? input.bannerUntil || null : null, at, adminId]
      )
      await writeAudit(client, adminId, {
        action: 'announcement.create',
        targetType: 'system',
        targetId: res.rows[0].id,
        details: { title: input.title, audience: input.audience, banner: input.banner, sendInApp: input.sendInApp, scheduledAt: at.toISOString() }
      })
      return res.rows[0].id as string
    })
    void this.deliverDue() // đến hạn ngay thì gửi luôn, không chờ nhịp kế
    return { id, scheduledAt: at.toISOString() }
  }

  // Hủy: chỉ khi chưa gửi; đã gửi mà còn banner thì gỡ banner
  async cancel(adminId: string, id: string): Promise<{ status: string }> {
    return this.db.transaction(async (client) => {
      const cur = await client.query(`SELECT status, banner FROM announcements WHERE id = $1 FOR UPDATE`, [id])
      if (!cur.rows[0]) throw new NotFoundException('Không tìm thấy thông báo')
      const { status, banner } = cur.rows[0]
      let next = status
      if (status === 'scheduled') {
        await client.query(`UPDATE announcements SET status = 'cancelled' WHERE id = $1`, [id])
        next = 'cancelled'
      } else if (status === 'sent' && banner) {
        await client.query(`UPDATE announcements SET banner_until = NOW() WHERE id = $1`, [id])
      } else {
        throw new BadRequestException('Thông báo này không còn gì để hủy')
      }
      await writeAudit(client, adminId, { action: 'announcement.cancel', targetType: 'system', targetId: id, details: { from: status } })
      return { status: next }
    })
  }

  // Banner đang hiển thị cho người dùng hiện tại (khách chỉ thấy banner gửi mọi người)
  async activeBanners(userId: string | null): Promise<AdminAnnouncementBanner[]> {
    const res = await this.db.query(
      `SELECT a.id, a.title, a.message, a.link FROM announcements a
       WHERE a.banner AND a.status = 'sent' AND (a.banner_until IS NULL OR a.banner_until > NOW())
         AND (COALESCE(jsonb_array_length(a.audience->'roles'), 0) + COALESCE(jsonb_array_length(a.audience->'universityIds'), 0) + COALESCE(jsonb_array_length(a.audience->'fieldIds'), 0) = 0
              OR EXISTS (SELECT 1 FROM users u WHERE u.id = $1::uuid AND ${MATCH}))
       ORDER BY a.sent_at DESC LIMIT 3`,
      [userId]
    )
    return res.rows
  }

  // Gửi các thông báo đến hạn; mỗi thông báo một transaction, lỗi thì quay lại, thử lại nhịp sau
  async deliverDue(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      for (let i = 0; i < 20; i++) {
        const done = await this.deliverOne().catch((err) => {
          this.logger.error(`Gửi thông báo lỗi: ${err?.message}`)
          return false
        })
        if (!done) break
      }
    } finally {
      this.busy = false
    }
  }

  private deliverOne(): Promise<boolean> {
    return this.db.transaction(async (client) => {
      const due = await client.query(
        `SELECT id, title, message, link, send_in_app FROM announcements
         WHERE status = 'scheduled' AND scheduled_at <= NOW() ORDER BY scheduled_at LIMIT 1 FOR UPDATE SKIP LOCKED`
      )
      const a = due.rows[0]
      if (!a) return false
      let count: number
      if (a.send_in_app) {
        const ins = await client.query(
          `INSERT INTO notifications (recipient_id, actor_id, actor_ids, actors_count, type, title, message, link, updated_at)
           SELECT u.id, NULL, '{}'::uuid[], 1, 'account_notice'::notification_type_enum, a.title, a.message, a.link, NOW()
           FROM announcements a JOIN users u ON TRUE WHERE a.id = $1 AND ${MATCH}`,
          [a.id]
        )
        count = ins.rowCount ?? 0
      } else {
        count = (await client.query(`SELECT COUNT(*)::int AS n FROM announcements a JOIN users u ON TRUE WHERE a.id = $1 AND ${MATCH}`, [a.id])).rows[0].n
      }
      await client.query(`UPDATE announcements SET status = 'sent', sent_at = NOW(), recipients_count = $2 WHERE id = $1`, [a.id, count])
      return true
    })
  }
}
