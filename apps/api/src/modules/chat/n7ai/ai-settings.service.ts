import { Injectable } from '@nestjs/common'
import type { AiConnectorId, AiSettings } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import type { AiSettingsBody } from '../dto/n7ai.dto'

const DEFAULT_CONNECTORS: AiConnectorId[] = ['library', 'web', 'my_study', 'my_chats']
const DEFAULTS: AiSettings = {
  memoryEnabled: true,
  retentionDays: null,
  defaultConnectors: DEFAULT_CONNECTORS,
  profile: { goal: null, about: null, style: null }
}
const COLUMNS = 'memory_enabled, retention_days, default_connectors, profile_goal, profile_about, profile_style'

const mapSettings = (r: any): AiSettings => ({
  memoryEnabled: r.memory_enabled,
  retentionDays: r.retention_days,
  defaultConnectors: r.default_connectors as AiConnectorId[],
  profile: { goal: r.profile_goal, about: r.profile_about, style: r.profile_style }
})

// Cài đặt N7AI của từng người (bảng ai_settings; chưa có hàng ⇒ mặc định)
@Injectable()
export class AiSettingsService {
  constructor(private readonly db: DatabaseService) {}

  async get(userId: string): Promise<AiSettings> {
    const res = await this.db.query(`SELECT ${COLUMNS} FROM ai_settings WHERE user_id = $1`, [userId])
    return res.rows[0] ? mapSettings(res.rows[0]) : DEFAULTS
  }

  // Upsert 1 câu lệnh: trường không gửi ⇒ giữ giá trị cũ (hoặc mặc định); trường hồ sơ gửi null ⇒ xóa
  async update(userId: string, patch: AiSettingsBody): Promise<AiSettings> {
    const profile = patch.profile ?? {}
    const keep = (field: keyof typeof profile) => !(field in profile)
    const res = await this.db.query(
      `INSERT INTO ai_settings (user_id, memory_enabled, retention_days, default_connectors, profile_goal, profile_about, profile_style)
       VALUES ($1, COALESCE($2, TRUE), $3, COALESCE($4, $12::text[]), $6, $8, $10)
       ON CONFLICT (user_id) DO UPDATE SET
         memory_enabled = COALESCE($2, ai_settings.memory_enabled),
         retention_days = CASE WHEN $5 THEN $3 ELSE ai_settings.retention_days END,
         default_connectors = COALESCE($4, ai_settings.default_connectors),
         profile_goal = CASE WHEN $7 THEN ai_settings.profile_goal ELSE $6 END,
         profile_about = CASE WHEN $9 THEN ai_settings.profile_about ELSE $8 END,
         profile_style = CASE WHEN $11 THEN ai_settings.profile_style ELSE $10 END,
         updated_at = NOW()
       RETURNING ${COLUMNS}`,
      [
        userId,
        patch.memoryEnabled ?? null,
        patch.retentionDays ?? null,
        patch.defaultConnectors ?? null,
        patch.retentionDays !== undefined,
        profile.goal ?? null,
        keep('goal'),
        profile.about ?? null,
        keep('about'),
        profile.style ?? null,
        keep('style'),
        DEFAULT_CONNECTORS
      ]
    )
    return mapSettings(res.rows[0])
  }
}
