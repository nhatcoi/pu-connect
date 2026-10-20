import { Injectable } from '@nestjs/common'
import type { AiModelOption } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { DEFAULT_AI_MODEL } from './ai-models'

interface CatalogEntry extends AiModelOption {
  visible: boolean
  enabled: boolean
  isDefault: boolean
}

const TTL_MS = 30_000
const FALLBACK: CatalogEntry = { id: DEFAULT_AI_MODEL, label: 'Nhanh', hint: '', cost: 1, visible: true, enabled: true, isDefault: true }

// Danh mục model N7AI (bảng ai_models): cache ngắn, admin ghi xong gọi invalidate()
// Catalog cached 30s; the API instance that handles an admin write refreshes immediately
@Injectable()
export class AiModelCatalogService {
  private cache: { at: number; rows: CatalogEntry[] } | null = null

  constructor(private readonly db: DatabaseService) {}

  invalidate() {
    this.cache = null
  }

  private async load(): Promise<CatalogEntry[]> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.rows
    const res = await this.db.query(`SELECT id, label, hint, cost, visible, enabled, is_default FROM ai_models ORDER BY sort_order, id`)
    const rows: CatalogEntry[] = res.rows.map((r) => ({ id: r.id, label: r.label, hint: r.hint, cost: r.cost, visible: r.visible, enabled: r.enabled, isDefault: r.is_default }))
    this.cache = { at: Date.now(), rows }
    return rows
  }

  // Menu của người dùng: model bật + hiển thị
  async options(): Promise<AiModelOption[]> {
    const rows = await this.load()
    return rows.filter((m) => m.enabled && m.visible).map(({ id, label, hint, cost }) => ({ id, label, hint, cost }))
  }

  // Model hợp lệ để dùng: tồn tại + đang bật (ẩn khỏi menu vẫn dùng được, vd. n7ai-deep)
  async isUsable(id: string): Promise<boolean> {
    return (await this.load()).some((m) => m.id === id && m.enabled)
  }

  // Model người dùng đã chọn bị tắt / xóa ⇒ rơi về mặc định (không bao giờ gửi tên model đã tắt lên gateway)
  async resolve(id: string | null | undefined): Promise<CatalogEntry> {
    const rows = await this.load()
    return rows.find((m) => m.id === id && m.enabled) ?? rows.find((m) => m.isDefault && m.enabled) ?? rows.find((m) => m.enabled) ?? FALLBACK
  }
}
