import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { PoolClient } from 'pg'
import type { AdminAiDiscovery, AdminAiProvider, AdminAiProviderInput, AdminAiProviderList, AdminAiProviderPatch, AdminAiProviderTest } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { AiProviderRegistry, readEnvProviders, withV1 } from '../ai/ai-provider.registry'
import { TokenCipher } from '../ai/connectors/token-cipher'
import { writeAudit } from './admin-audit'

const PROBE_TIMEOUT_MS = 8000
const STEP = 10

const toDto = (r: Record<string, any>): AdminAiProvider => ({
  id: r.id,
  name: r.name,
  baseUrl: r.base_url,
  keyHint: r.key_hint,
  modelOverride: r.model_override,
  enabled: r.enabled,
  priority: r.priority
})

// Provider AI (base URL + API key OpenAI-compatible): thêm / sửa / bật tắt / đổi thứ tự / thử kết nối
// Không còn provider bật nào trong DB ⇒ API tự dùng cấu hình env (list() báo source = 'env')
// Key mã hóa AES-256-GCM trong DB, chỉ nhận một chiều: không có endpoint nào trả key (chỉ 4 ký tự cuối); nhật ký không chứa key
@Injectable()
export class AdminAiProvidersService {
  private readonly cipher: TokenCipher

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly registry: AiProviderRegistry
  ) {
    this.cipher = new TokenCipher(config.get<string>('CONNECTOR_ENCRYPTION_KEY') || config.get<string>('SESSION_SECRET') || 'dev-connector-key')
  }

  async list(): Promise<AdminAiProviderList> {
    const res = await this.db.query(`SELECT id, name, base_url, key_hint, model_override, enabled, priority FROM ai_providers ORDER BY priority, created_at`)
    const items = res.rows.map(toDto)
    const env = readEnvProviders(this.config).map((c) => ({ name: c.name, host: this.host(c.baseUrl), modelOverride: c.modelOverride }))
    return { source: items.some((i) => i.enabled) ? 'database' : 'env', items, env }
  }

  async create(adminId: string, input: AdminAiProviderInput): Promise<{ id: string }> {
    const id = await this.db.transaction(async (client) => {
      const id = await this.insert(client, { name: input.name, baseUrl: input.baseUrl, apiKey: input.apiKey, modelOverride: input.modelOverride ?? null })
      await writeAudit(client, adminId, {
        action: 'ai_provider.create',
        targetType: 'ai_provider',
        targetId: id,
        details: { name: input.name, host: this.host(input.baseUrl) }
      })
      return id
    })
    this.registry.invalidate()
    return { id }
  }

  // Chuyển cấu hình env sang DB (key mã hóa) để quản lý trên admin; chỉ làm khi DB còn trống
  async importFromEnv(adminId: string): Promise<{ imported: number }> {
    const envs = readEnvProviders(this.config)
    if (!envs.length) throw new BadRequestException('Máy chủ chưa cấu hình AI_API_KEY')
    const imported = await this.db.transaction(async (client) => {
      const count = await client.query(`SELECT COUNT(*)::int AS n FROM ai_providers`)
      if (count.rows[0].n > 0) throw new ConflictException('Đã có provider trong danh sách')
      for (const c of envs) {
        // Thiếu AI_BASE_URL ⇒ SDK dùng mặc định của OpenAI
        await this.insert(client, {
          name: c.name.replace(/ \(env\)$/, ''),
          baseUrl: c.baseUrl ?? 'https://api.openai.com/v1',
          apiKey: c.apiKey,
          modelOverride: c.modelOverride
        })
      }
      await writeAudit(client, adminId, { action: 'ai_provider.import_env', targetType: 'ai_provider', targetId: 'env', details: { count: envs.length } })
      return envs.length
    })
    this.registry.invalidate()
    return { imported }
  }

  async update(adminId: string, id: string, patch: AdminAiProviderPatch): Promise<void> {
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, id)
      const sets: string[] = []
      const vals: unknown[] = []
      const add = (col: string, v: unknown) => {
        vals.push(v)
        sets.push(`${col} = $${vals.length}`)
      }
      if (patch.name !== undefined) add('name', patch.name)
      if (patch.baseUrl !== undefined) add('base_url', patch.baseUrl)
      if (patch.modelOverride !== undefined) add('model_override', patch.modelOverride)
      if (patch.enabled !== undefined) add('enabled', patch.enabled)
      if (patch.apiKey) {
        add('api_key_enc', this.cipher.encrypt(patch.apiKey))
        add('key_hint', patch.apiKey.slice(-4))
      }
      vals.push(id)
      await client.query(`UPDATE ai_providers SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals)
      // Nhật ký chỉ ghi tên trường đã đổi, không ghi giá trị key
      await writeAudit(client, adminId, {
        action: 'ai_provider.update',
        targetType: 'ai_provider',
        targetId: id,
        details: { name: cur.name, fields: Object.keys(patch) }
      })
    })
    this.registry.invalidate()
  }

  async remove(adminId: string, id: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, id)
      await client.query(`DELETE FROM ai_providers WHERE id = $1`, [id])
      await writeAudit(client, adminId, { action: 'ai_provider.delete', targetType: 'ai_provider', targetId: id, details: { name: cur.name } })
    })
    this.registry.invalidate()
  }

  // Đổi chỗ với provider kề trên / dưới (đánh lại priority 10, 20, 30… để luôn liên tục)
  async move(adminId: string, id: string, direction: 'up' | 'down'): Promise<void> {
    await this.db.transaction(async (client) => {
      const res = await client.query(`SELECT id FROM ai_providers ORDER BY priority, created_at FOR UPDATE`)
      const ids: string[] = res.rows.map((r) => r.id)
      const from = ids.indexOf(id)
      if (from < 0) throw new NotFoundException('Provider không tồn tại')
      const to = direction === 'up' ? from - 1 : from + 1
      if (to < 0 || to >= ids.length) return
      ;[ids[from], ids[to]] = [ids[to], ids[from]]
      for (let i = 0; i < ids.length; i++)
        await client.query(`UPDATE ai_providers SET priority = $2, updated_at = NOW() WHERE id = $1`, [ids[i], (i + 1) * STEP])
      await writeAudit(client, adminId, { action: 'ai_provider.move', targetType: 'ai_provider', targetId: id, details: { direction } })
    })
    this.registry.invalidate()
  }

  // Thử kết nối thật: GET {baseUrl}/models bằng key đã lưu. Không trả nội dung phản hồi (tránh lộ dữ liệu), lỗi chỉ ở dạng mã ngắn
  async test(id: string): Promise<AdminAiProviderTest> {
    const res = await this.db.query(`SELECT base_url, api_key_enc FROM ai_providers WHERE id = $1`, [id])
    if (!res.rows[0]) throw new NotFoundException('Provider không tồn tại')
    let apiKey: string
    try {
      apiKey = this.cipher.decrypt(res.rows[0].api_key_enc)
    } catch {
      return { ok: false, latencyMs: 0, models: null, error: 'Không giải mã được API key — nhập lại key' }
    }
    const started = Date.now()
    try {
      const r = await fetch(`${withV1(res.rows[0].base_url)}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
      })
      const latencyMs = Date.now() - started
      if (!r.ok)
        return {
          ok: false,
          latencyMs,
          models: null,
          error: r.status === 401 || r.status === 403 ? `Key bị từ chối (HTTP ${r.status})` : `Gateway trả HTTP ${r.status}`
        }
      const body = (await r.json().catch(() => null)) as { data?: unknown[] } | null
      return { ok: true, latencyMs, models: Array.isArray(body?.data) ? body.data.length : null }
    } catch (err) {
      const timeout = (err as Error).name === 'TimeoutError'
      return { ok: false, latencyMs: Date.now() - started, models: null, error: timeout ? 'Quá thời gian chờ' : 'Không kết nối được tới URL này' }
    }
  }

  // Dò model: GET {baseUrl}/models bằng key đã lưu ⇒ danh sách tên model (chỉ tên, không trả phần còn lại của phản hồi) + đã thêm vào danh mục chưa
  async discover(id: string): Promise<AdminAiDiscovery> {
    const res = await this.db.query(`SELECT base_url, api_key_enc FROM ai_providers WHERE id = $1`, [id])
    if (!res.rows[0]) throw new NotFoundException('Provider không tồn tại')
    let apiKey: string
    try {
      apiKey = this.cipher.decrypt(res.rows[0].api_key_enc)
    } catch {
      return { ok: false, latencyMs: 0, models: [], error: 'Không giải mã được API key — nhập lại key' }
    }
    const started = Date.now()
    try {
      const r = await fetch(`${withV1(res.rows[0].base_url)}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
      })
      const latencyMs = Date.now() - started
      if (!r.ok)
        return {
          ok: false,
          latencyMs,
          models: [],
          error: r.status === 401 || r.status === 403 ? `Key bị từ chối (HTTP ${r.status})` : `Gateway trả HTTP ${r.status}`
        }
      const body = (await r.json().catch(() => null)) as { data?: { id?: unknown }[] } | null
      const names = [
        ...new Set(
          (Array.isArray(body?.data) ? body.data : [])
            .map((m) => m?.id)
            .filter((n): n is string => typeof n === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$/.test(n))
        )
      ].sort()
      const used = await this.db.query(`SELECT COALESCE(upstream_model, id) AS name FROM ai_models WHERE provider_id = $1`, [id])
      const imported = new Set<string>(used.rows.map((u) => u.name))
      return { ok: true, latencyMs, models: names.map((name) => ({ name, imported: imported.has(name) })) }
    } catch (err) {
      const timeout = (err as Error).name === 'TimeoutError'
      return { ok: false, latencyMs: Date.now() - started, models: [], error: timeout ? 'Quá thời gian chờ' : 'Không kết nối được tới URL này' }
    }
  }

  private async insert(client: PoolClient, v: { name: string; baseUrl: string; apiKey: string; modelOverride: string | null }): Promise<string> {
    const res = await client.query(
      `INSERT INTO ai_providers (name, base_url, api_key_enc, key_hint, model_override, priority)
       VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(priority) FROM ai_providers), 0) + ${STEP}) RETURNING id`,
      [v.name, v.baseUrl, this.cipher.encrypt(v.apiKey), v.apiKey.slice(-4), v.modelOverride]
    )
    return res.rows[0].id
  }

  private async lock(client: PoolClient, id: string) {
    const res = await client.query(`SELECT id, name, enabled FROM ai_providers WHERE id = $1 FOR UPDATE`, [id])
    if (!res.rows[0]) throw new NotFoundException('Provider không tồn tại')
    return res.rows[0] as { id: string; name: string; enabled: boolean }
  }

  private host(url: string | undefined) {
    try {
      return url ? new URL(url).host : 'api.openai.com'
    } catch {
      return url ?? ''
    }
  }
}
