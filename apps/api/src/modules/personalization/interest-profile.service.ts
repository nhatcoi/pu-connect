import { Injectable, Logger } from '@nestjs/common'
import type { InterestKind } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { INTEREST_PROFILE_SQL } from './interest-profile.sql'
import { PROFILE_TTL_HOURS, personalizationOnSql } from './personalization.constants'

export interface InterestTopic {
  kind: InterestKind
  key: string
  label: string
  score: number
}

// Hồ sơ quan tâm (user_interests): tính lại từ hành động + sự kiện, đọc top chủ đề
// Interest profile: recompute from actions & events, read top topics
@Injectable()
export class InterestProfileService {
  private readonly logger = new Logger(InterestProfileService.name)

  constructor(private readonly db: DatabaseService) {}

  // Tính lại toàn bộ hồ sơ của 1 người (thay thế trong 1 transaction)
  async recompute(userId: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const rows = (await client.query(INTEREST_PROFILE_SQL, [userId])).rows
      await client.query(`DELETE FROM user_interests WHERE user_id = $1`, [userId])
      if (rows.length) {
        await client.query(
          `INSERT INTO user_interests (user_id, kind, key, label, score)
           SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::real[])`,
          [userId, rows.map((r) => r.kind), rows.map((r) => r.key), rows.map((r) => r.label), rows.map((r) => r.score)]
        )
      }
      await client.query(`UPDATE users SET interests_updated_at = NOW() WHERE id = $1`, [userId])
    })
  }

  // Top chủ đề; hồ sơ cũ / chưa có ⇒ tính lại trước (tắt cá nhân hóa ⇒ rỗng)
  async topTopics(userId: string, limit = 8): Promise<InterestTopic[]> {
    const state = await this.db.query(
      `SELECT ${personalizationOnSql('u')} AS enabled,
              (u.interests_updated_at IS NULL OR u.interests_updated_at < NOW() - INTERVAL '${PROFILE_TTL_HOURS} hours') AS stale
       FROM users u WHERE u.id = $1`,
      [userId]
    )
    const s = state.rows[0]
    if (!s?.enabled) return []
    if (s.stale) {
      try {
        await this.recompute(userId)
      } catch (err: any) {
        this.logger.warn(`Tính hồ sơ quan tâm thất bại (${userId}): ${err?.message}`) // vẫn dùng hồ sơ cũ
      }
    }
    const res = await this.db.query(`SELECT kind, key, label, score FROM user_interests WHERE user_id = $1 ORDER BY score DESC LIMIT $2`, [userId, limit])
    return res.rows
  }

  // Worker: người hoạt động gần đây có hồ sơ đã cũ
  async staleActiveUsers(limit: number): Promise<string[]> {
    const res = await this.db.query(
      `SELECT u.id FROM users u
       WHERE u.account_type = 'human' AND ${personalizationOnSql('u')}
         AND (u.last_seen_at > NOW() - INTERVAL '1 day' OR EXISTS (
           SELECT 1 FROM user_events e WHERE e.user_id = u.id AND e.created_at > NOW() - INTERVAL '1 day'))
         AND (u.interests_updated_at IS NULL OR u.interests_updated_at < NOW() - INTERVAL '1 hour')
       ORDER BY u.interests_updated_at NULLS FIRST LIMIT $1`,
      [limit]
    )
    return res.rows.map((r) => r.id)
  }
}
