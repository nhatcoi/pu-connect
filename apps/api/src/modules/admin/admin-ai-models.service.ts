import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { AdminAiModel, AdminAiModelInput, AdminAiModelPatch } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { AiModelCatalogService } from '../ai/ai-model-catalog.service'
import { writeAudit } from './admin-audit'

// Danh mục model N7AI: thêm / sửa / bật tắt / đặt mặc định / xóa (mọi thay đổi ghi nhật ký admin)
// Chỉ lưu tên model + mô tả + quota; API key và base URL vẫn ở env của server, admin không thấy
@Injectable()
export class AdminAiModelsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: AiModelCatalogService
  ) {}

  async list(): Promise<AdminAiModel[]> {
    const res = await this.db.query(
      `SELECT m.id, m.label, m.hint, m.cost, m.visible, m.enabled, m.is_default, m.sort_order,
              (SELECT COUNT(*)::int FROM ai_settings s WHERE s.ai_model = m.id) AS users,
              COALESCE(r.runs, 0) AS runs7d, COALESCE(r.errors, 0) AS errors7d
       FROM ai_models m
       LEFT JOIN (
         SELECT model, COUNT(*)::int AS runs, COUNT(*) FILTER (WHERE status = 'error')::int AS errors
         FROM ai_runs WHERE created_at > NOW() - INTERVAL '7 days' AND status <> 'rejected' GROUP BY model
       ) r ON r.model = m.id
       ORDER BY m.sort_order, m.id`
    )
    return res.rows.map((r) => ({
      id: r.id,
      label: r.label,
      hint: r.hint,
      cost: r.cost,
      visible: r.visible,
      enabled: r.enabled,
      isDefault: r.is_default,
      sortOrder: r.sort_order,
      users: r.users,
      runs7d: r.runs7d,
      errors7d: r.errors7d
    }))
  }

  async create(adminId: string, input: AdminAiModelInput): Promise<void> {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `INSERT INTO ai_models (id, label, hint, cost, visible, sort_order)
         VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(sort_order) FROM ai_models), 0) + 10)
         ON CONFLICT (id) DO NOTHING`,
        [input.id, input.label, input.hint ?? '', input.cost ?? 1, input.visible ?? true]
      )
      if (!res.rowCount) throw new ConflictException('Model này đã có trong danh mục')
      await writeAudit(client, adminId, { action: 'ai_model.create', targetType: 'ai_model', targetId: input.id, details: { label: input.label, cost: input.cost ?? 1 } })
    })
    this.catalog.invalidate()
  }

  async update(adminId: string, id: string, patch: AdminAiModelPatch): Promise<void> {
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, id)
      if (patch.enabled === false && cur.is_default) throw new ConflictException('Không thể tắt model mặc định — hãy đặt model khác làm mặc định trước')
      if (patch.isDefault && !(patch.enabled ?? cur.enabled)) throw new ConflictException('Model đang tắt không thể làm mặc định')
      const sets: string[] = []
      const vals: unknown[] = []
      const add = (col: string, v: unknown) => {
        vals.push(v)
        sets.push(`${col} = $${vals.length}`)
      }
      if (patch.label !== undefined) add('label', patch.label)
      if (patch.hint !== undefined) add('hint', patch.hint)
      if (patch.cost !== undefined) add('cost', patch.cost)
      if (patch.visible !== undefined) add('visible', patch.visible)
      if (patch.enabled !== undefined) add('enabled', patch.enabled)
      if (patch.isDefault) {
        // Đúng 1 mặc định: bỏ cờ cũ trước khi đặt (unique index một phần)
        await client.query(`UPDATE ai_models SET is_default = FALSE WHERE is_default AND id <> $1`, [id])
        add('is_default', true)
      }
      vals.push(id)
      await client.query(`UPDATE ai_models SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals)
      await writeAudit(client, adminId, { action: 'ai_model.update', targetType: 'ai_model', targetId: id, details: { patch } })
    })
    this.catalog.invalidate()
  }

  async remove(adminId: string, id: string): Promise<{ movedUsers: number }> {
    const out = await this.db.transaction(async (client) => {
      const cur = await this.lock(client, id)
      if (cur.is_default) throw new ConflictException('Không thể xóa model mặc định')
      // Người đang chọn model này chuyển về mặc định; lịch sử ai_runs giữ nguyên tên model
      const moved = await client.query(`UPDATE ai_settings SET ai_model = (SELECT id FROM ai_models WHERE is_default), updated_at = NOW() WHERE ai_model = $1`, [id])
      await client.query(`DELETE FROM ai_models WHERE id = $1`, [id])
      await writeAudit(client, adminId, { action: 'ai_model.delete', targetType: 'ai_model', targetId: id, details: { label: cur.label, users: moved.rowCount } })
      return { movedUsers: moved.rowCount ?? 0 }
    })
    this.catalog.invalidate()
    return out
  }

  private async lock(client: PoolClient, id: string) {
    const res = await client.query(`SELECT id, label, enabled, is_default FROM ai_models WHERE id = $1 FOR UPDATE`, [id])
    if (!res.rows[0]) throw new NotFoundException('Model không tồn tại')
    return res.rows[0] as { id: string; label: string; enabled: boolean; is_default: boolean }
  }
}
