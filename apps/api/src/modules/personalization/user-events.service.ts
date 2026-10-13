import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { TrackEventsBody } from './dto/personalization.dto'
import { EVENT_RETENTION_DAYS, personalizationOnSql } from './personalization.constants'

// Nhật ký hành vi ngầm (user_events): ghi theo lô, tôn trọng cờ quyền riêng tư, tự xóa sau 90 ngày
// Implicit behaviour log: batched insert, honours the privacy flag, purged after retention
@Injectable()
export class UserEventsService {
  constructor(private readonly db: DatabaseService) {}

  // 1 câu INSERT cho cả lô; tắt cá nhân hóa ⇒ không ghi gì
  async track(userId: string, { events }: TrackEventsBody): Promise<void> {
    await this.db.query(
      `INSERT INTO user_events (user_id, type, target_type, target_id, meta)
       SELECT u.id, e.type, e.target_type, e.target_id, e.meta
       FROM users u, unnest($2::text[], $3::text[], $4::uuid[], $5::jsonb[]) AS e(type, target_type, target_id, meta)
       WHERE u.id = $1 AND ${personalizationOnSql('u')}`,
      [
        userId,
        events.map((e) => e.type),
        events.map((e) => (e.targetId ? (e.targetType ?? null) : null)),
        events.map((e) => (e.targetType ? (e.targetId ?? null) : null)),
        events.map((e) => (e.meta ? JSON.stringify(e.meta) : null))
      ]
    )
  }

  // Tắt cá nhân hóa ⇒ xóa sạch hành vi & hồ sơ đã suy ra
  async forget(userId: string): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(`DELETE FROM user_events WHERE user_id = $1`, [userId])
      await client.query(`DELETE FROM user_interests WHERE user_id = $1`, [userId])
      await client.query(`UPDATE users SET interests_updated_at = NULL WHERE id = $1`, [userId])
    })
  }

  async purgeExpired(): Promise<number> {
    const res = await this.db.query(`DELETE FROM user_events WHERE created_at < NOW() - make_interval(days => $1)`, [EVENT_RETENTION_DAYS])
    return res.rowCount ?? 0
  }
}
