import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { PushService } from '../push/push.service'
import { type NotificationItem, type NotificationType, type NotifyInput } from './notification.types'
import { buildStoragePatch, isInAppEnabled, resolveSettings, type NotificationSettings } from './notification-settings'

const RETENTION_DAYS = 90
const MAX_ACTORS_TRACKED = 50

// Trung tâm thông báo: lọc → lưu (gộp nhóm) → đẩy realtime
// Notification hub: filter → persist (aggregate) → deliver (socket)
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name)
  private cleanupTimer?: NodeJS.Timeout

  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService
  ) {}

  onModuleInit() {
    // Dọn thông báo đã đọc quá 90 ngày, mỗi 24h (Retention cleanup)
    this.cleanupTimer = setInterval(() => void this.cleanup(), 24 * 60 * 60 * 1000)
    this.cleanupTimer.unref()
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
  }

  // ── Gửi ──────────────────────────────────────────────────────────

  // Gửi nhiều thông báo cho một sự kiện; mỗi người nhận chỉ nhận MỘT thông báo
  // (thứ tự mảng = độ ưu tiên, ví dụ reply > mention > post_comment)
  async dispatch(inputs: NotifyInput[]): Promise<void> {
    const seen = new Set<string>()
    for (const input of inputs) {
      if (seen.has(input.recipientId)) continue
      seen.add(input.recipientId)
      await this.notify(input).catch((err) =>
        this.logger.error(`notify ${input.type} → ${input.recipientId} failed: ${err?.message}`)
      )
    }
  }

  async notify(input: NotifyInput): Promise<void> {
    if (input.actorId && input.actorId === input.recipientId) return // không tự báo cho mình

    const recipient = await this.db.query(
      `SELECT account_type, notification_settings FROM users WHERE id = $1 LIMIT 1`,
      [input.recipientId]
    )
    const row = recipient.rows[0]
    if (!row || row.account_type !== 'human') return // bot không nhận thông báo
    if (!isInAppEnabled(row.notification_settings, input.type)) return // người dùng đã tắt loại này

    const actorName = input.actorId ? await this.actorName(input.actorId) : null
    const saved = input.groupKey
      ? await this.upsertGrouped(input, actorName)
      : await this.insertSingle(input, actorName)
    if (!saved) return // actor đã có trong nhóm (ví dụ bỏ thích rồi thích lại) ⇒ không báo lại

    const item = await this.findOneItem(saved)
    const unreadCount = await this.unreadCount(input.recipientId)
    this.realtime.emitToUser(input.recipientId, 'notification', { notification: item, unreadCount })

    // Kênh ngoài app: worker quyết định sau 30s (đã đọc / đang xem / giờ yên tĩnh / đã tắt)
    await this.push.enqueue(saved, input.recipientId)
  }

  private buildTitle(actorName: string | null, actorsCount: number, verb: string): string {
    if (!actorName) return verb.charAt(0).toUpperCase() + verb.slice(1)
    const others = actorsCount > 1 ? ` và ${actorsCount - 1} người khác` : ''
    return `${actorName}${others} ${verb}`
  }

  private async insertSingle(input: NotifyInput, actorName: string | null): Promise<string> {
    const res = await this.db.query(
      `INSERT INTO notifications (recipient_id, actor_id, actor_ids, actors_count, type, title, message,
                                  entity_id, entity_type, link, updated_at)
       VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id`,
      [
        input.recipientId,
        input.actorId,
        input.actorId ? [input.actorId] : [],
        input.type,
        this.buildTitle(actorName, 1, input.verb),
        input.message || '',
        input.entityId || null,
        input.entityType || null,
        input.link || null
      ]
    )
    return res.rows[0].id
  }

  // Upsert nguyên tử theo (recipient_id, group_key) chưa đọc; trả về null nếu actor đã có trong nhóm
  private async upsertGrouped(input: NotifyInput, actorName: string | null): Promise<string | null> {
    const res = await this.db.query(
      `INSERT INTO notifications (recipient_id, actor_id, actor_ids, actors_count, type, title, message,
                                  entity_id, entity_type, link, group_key, updated_at)
       VALUES ($1, $2, ARRAY[$2]::uuid[], 1, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (recipient_id, group_key) WHERE is_read = FALSE AND group_key IS NOT NULL
       DO UPDATE SET
         actor_id = EXCLUDED.actor_id,
         actor_ids = (ARRAY[EXCLUDED.actor_id] || notifications.actor_ids)[1:${MAX_ACTORS_TRACKED}],
         actors_count = notifications.actors_count + 1,
         message = EXCLUDED.message,
         link = EXCLUDED.link,
         updated_at = NOW()
       WHERE NOT (notifications.actor_ids @> ARRAY[EXCLUDED.actor_id])
       RETURNING id, actors_count`,
      [
        input.recipientId,
        input.actorId,
        input.type,
        this.buildTitle(actorName, 1, input.verb),
        input.message || '',
        input.entityId || null,
        input.entityType || null,
        input.link || null,
        input.groupKey
      ]
    )
    if (res.rows.length === 0) return null
    const { id, actors_count } = res.rows[0]
    if (actors_count > 1) {
      await this.db.query(`UPDATE notifications SET title = $1 WHERE id = $2`, [
        this.buildTitle(actorName, actors_count, input.verb),
        id
      ])
    }
    return id
  }

  private async actorName(actorId: string): Promise<string> {
    const res = await this.db.query(`SELECT display_name, username FROM users WHERE id = $1`, [actorId])
    return res.rows[0]?.display_name || res.rows[0]?.username || 'Ai đó'
  }

  // ── Đọc ──────────────────────────────────────────────────────────

  async findAll(
    recipientId: string,
    opts: { limit?: number; before?: string; unreadOnly?: boolean; type?: string } = {}
  ): Promise<{ data: NotificationItem[]; unreadCount: number; nextCursor: string | null }> {
    const limit = Math.min(50, Math.max(1, opts.limit || 15))
    const params: unknown[] = [recipientId]
    let where = `n.recipient_id = $1`

    // Cursor = "updatedAt|id" (keyset pagination, ổn định khi có thông báo mới)
    if (opts.before) {
      const [ts, id] = opts.before.split('|')
      if (ts && id && !Number.isNaN(Date.parse(ts))) {
        params.push(ts, id)
        where += ` AND (n.updated_at, n.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
      }
    }
    if (opts.unreadOnly) where += ` AND n.is_read = FALSE`
    if (opts.type) {
      params.push(opts.type)
      where += ` AND n.type::text = $${params.length}`
    }
    params.push(limit + 1)

    const res = await this.db.query(
      `${this.selectSql()} WHERE ${where}
       ORDER BY n.updated_at DESC, n.id DESC LIMIT $${params.length}`,
      params
    )
    const rows = res.rows.slice(0, limit)
    const last = rows[rows.length - 1]
    return {
      data: rows.map((r) => this.mapRow(r)),
      unreadCount: await this.unreadCount(recipientId),
      nextCursor: res.rows.length > limit && last ? `${new Date(last.updated_at).toISOString()}|${last.id}` : null
    }
  }

  async unreadCount(recipientId: string): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND is_read = FALSE`,
      [recipientId]
    )
    return res.rows[0]?.count || 0
  }

  async markAsRead(id: string, recipientId: string): Promise<{ success: boolean; unreadCount: number }> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2 AND is_read = FALSE`,
      [id, recipientId]
    )
    return this.afterRead(recipientId, { ids: [id] })
  }

  async markAllAsRead(recipientId: string): Promise<{ success: boolean; unreadCount: number }> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND is_read = FALSE`,
      [recipientId]
    )
    return this.afterRead(recipientId, { all: true })
  }

  // Đồng bộ trạng thái đã đọc sang các tab/thiết bị khác
  private async afterRead(recipientId: string, payload: { ids?: string[]; all?: boolean }) {
    const unreadCount = await this.unreadCount(recipientId)
    this.realtime.emitToUser(recipientId, 'notification.read', { ...payload, unreadCount })
    return { success: true, unreadCount }
  }

  // ── Cài đặt ──────────────────────────────────────────────────────

  async getSettings(userId: string): Promise<NotificationSettings> {
    const res = await this.db.query(`SELECT notification_settings FROM users WHERE id = $1`, [userId])
    return resolveSettings(res.rows[0]?.notification_settings)
  }

  // Patch dạng { inApp?: {type: bool}, push?: {type: bool}, quietHours?: {...} }
  async updateSettings(userId: string, patch: unknown): Promise<NotificationSettings> {
    const clean = buildStoragePatch(patch)
    const { push, quiet_hours, ...flat } = clean as { push?: object; quiet_hours?: object }
    // Merge sâu cho object con (push, quiet_hours) để không ghi đè key khác
    await this.db.query(
      `UPDATE users SET notification_settings =
         notification_settings || $1::jsonb
         || jsonb_build_object('push', COALESCE(notification_settings->'push', '{}'::jsonb) || $2::jsonb)
         || jsonb_build_object('quiet_hours', COALESCE(notification_settings->'quiet_hours', '{}'::jsonb) || $3::jsonb)
       WHERE id = $4`,
      [JSON.stringify(flat), JSON.stringify(push || {}), JSON.stringify(quiet_hours || {}), userId]
    )
    return this.getSettings(userId)
  }

  // ── Nội bộ ──────────────────────────────────────────────────────

  private selectSql() {
    return `SELECT n.*, u.username AS actor_username, u.display_name AS actor_display_name,
                   u.avatar_url AS actor_avatar_url
            FROM notifications n LEFT JOIN users u ON u.id = n.actor_id`
  }

  private async findOneItem(id: string): Promise<NotificationItem> {
    const res = await this.db.query(`${this.selectSql()} WHERE n.id = $1`, [id])
    return this.mapRow(res.rows[0])
  }

  private mapRow(row: any): NotificationItem {
    return {
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      message: row.message,
      link: row.link || (row.entity_type === 'post' && row.entity_id ? `/post/${row.entity_id}` : null),
      entityId: row.entity_id,
      entityType: row.entity_type,
      actorsCount: row.actors_count || 1,
      actor: row.actor_id
        ? {
            id: row.actor_id,
            username: row.actor_username || 'user',
            displayName: row.actor_display_name || 'Người dùng Phenikaa',
            avatarUrl: row.actor_avatar_url || null
          }
        : null,
      isRead: !!row.is_read,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at || row.created_at).toISOString()
    }
  }

  private async cleanup() {
    try {
      const res = await this.db.query(
        `DELETE FROM notifications WHERE is_read = TRUE AND updated_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`
      )
      if (res.rowCount) this.logger.log(`Retention cleanup: removed ${res.rowCount} notifications`)
    } catch (err: any) {
      this.logger.error(`Retention cleanup failed: ${err?.message}`)
    }
  }
}
