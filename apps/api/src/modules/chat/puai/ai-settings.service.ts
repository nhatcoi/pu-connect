import { Injectable } from '@nestjs/common'
import type { AiConnectorId, AiSettings } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import type { AiSettingsBody } from '../dto/puai.dto'

const DEFAULTS: AiSettings = { memoryEnabled: true, retentionDays: null, defaultConnectors: ['library', 'web'] }

const mapSettings = (r: any): AiSettings => ({
  memoryEnabled: r.memory_enabled,
  retentionDays: r.retention_days,
  defaultConnectors: r.default_connectors as AiConnectorId[]
})

// Cài đặt PU AI của từng người (bảng ai_settings; chưa có hàng ⇒ mặc định)
@Injectable()
export class AiSettingsService {
  constructor(private readonly db: DatabaseService) {}

  async get(userId: string): Promise<AiSettings> {
    const res = await this.db.query(`SELECT memory_enabled, retention_days, default_connectors FROM ai_settings WHERE user_id = $1`, [userId])
    return res.rows[0] ? mapSettings(res.rows[0]) : DEFAULTS
  }

  // Upsert 1 câu lệnh: trường không gửi ⇒ giữ giá trị cũ (hoặc mặc định)
  async update(userId: string, patch: AiSettingsBody): Promise<AiSettings> {
    const res = await this.db.query(
      `INSERT INTO ai_settings (user_id, memory_enabled, retention_days, default_connectors)
       VALUES ($1, COALESCE($2, TRUE), $3, COALESCE($4, '{library,web}'::text[]))
       ON CONFLICT (user_id) DO UPDATE SET
         memory_enabled = COALESCE($2, ai_settings.memory_enabled),
         retention_days = CASE WHEN $5 THEN $3 ELSE ai_settings.retention_days END,
         default_connectors = COALESCE($4, ai_settings.default_connectors),
         updated_at = NOW()
       RETURNING memory_enabled, retention_days, default_connectors`,
      [userId, patch.memoryEnabled ?? null, patch.retentionDays ?? null, patch.defaultConnectors ?? null, patch.retentionDays !== undefined]
    )
    return mapSettings(res.rows[0])
  }
}
