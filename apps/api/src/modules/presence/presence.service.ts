import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { PresenceMap, PresenceUpdateEvent } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { blockExistsSql } from '../blocks/blocks.sql'

// Chờ trước khi báo offline: reload / mất mạng ngắn không làm nháy trạng thái
const OFFLINE_GRACE_MS = 15_000

// Người dùng bật hiển thị trạng thái hoạt động (mặc định bật)
const activityVisible = (alias: string) => `COALESCE((${alias}.privacy_settings->>'showActivityStatus')::boolean, TRUE)`

// "Liên hệ" của $1: người thật cùng ở ít nhất 1 hội thoại, không chặn nhau, cả hai cùng bật trạng thái
const CONTACTS_SQL = `
  SELECT DISTINCT o.user_id, u.last_seen_at
  FROM users me_u
  JOIN conversation_members me ON me.user_id = me_u.id AND me.left_at IS NULL
  JOIN conversation_members o ON o.conversation_id = me.conversation_id AND o.user_id <> me.user_id AND o.left_at IS NULL
  JOIN users u ON u.id = o.user_id AND u.account_type = 'human' AND ${activityVisible('u')}
  WHERE me_u.id = $1 AND ${activityVisible('me_u')} AND NOT ${blockExistsSql('$1::uuid', 'o.user_id')}`

// Trạng thái hoạt động: chỉ chia sẻ với người cùng hội thoại (Domain 10)
// Presence policy on top of the gateway's connection counting
@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway
  ) {}

  onModuleInit() {
    this.realtime.onPresenceChange((userId, online) => (online ? this.wentOnline(userId) : this.wentOffline(userId)))
  }

  onModuleDestroy() {
    for (const timer of this.offlineTimers.values()) clearTimeout(timer)
  }

  // Trạng thái các liên hệ của user (nạp lần đầu, sau đó cập nhật qua presence.update)
  async contacts(userId: string): Promise<PresenceMap> {
    const res = await this.db.query(CONTACTS_SQL, [userId])
    const map: PresenceMap = {}
    for (const row of res.rows) {
      map[row.user_id] = {
        online: this.realtime.isOnline(row.user_id),
        lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null
      }
    }
    return map
  }

  private wentOnline(userId: string) {
    const pending = this.offlineTimers.get(userId)
    if (pending) {
      // Kết nối lại trong thời gian chờ ⇒ người khác vẫn thấy đang hoạt động, không cần báo
      clearTimeout(pending)
      this.offlineTimers.delete(userId)
      return
    }
    void this.broadcast({ userId, online: true, lastSeenAt: null })
  }

  private wentOffline(userId: string) {
    const timer = setTimeout(() => {
      this.offlineTimers.delete(userId)
      if (this.realtime.isOnline(userId)) return
      void this.markOffline(userId)
    }, OFFLINE_GRACE_MS)
    timer.unref()
    this.offlineTimers.set(userId, timer)
  }

  private async markOffline(userId: string) {
    const res = await this.db.query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1 RETURNING last_seen_at`, [userId])
    const lastSeen = res.rows[0]?.last_seen_at
    await this.broadcast({ userId, online: false, lastSeenAt: lastSeen ? new Date(lastSeen).toISOString() : null })
  }

  // Báo cho mọi liên hệ (quan hệ đối xứng ⇒ dùng chung CONTACTS_SQL)
  private async broadcast(event: PresenceUpdateEvent) {
    const res = await this.db.query(CONTACTS_SQL, [event.userId])
    for (const row of res.rows) this.realtime.emitToUser(row.user_id, 'presence.update', event)
  }
}
