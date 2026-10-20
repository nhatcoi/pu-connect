import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { DatabaseService } from '../../database/database.service'
import { TokenCipher } from './connectors/token-cipher'
import { DEFAULT_AI_MODEL } from './ai-models'

const TTL_MS = 30_000
const COOLDOWN_MS = 60_000 // provider lỗi gateway ⇒ 60s bỏ qua / failing provider is skipped for 60s
const TIMEOUT_MS = 120_000

export const withV1 = (url?: string) => (url && !/\/v1\/?$/.test(url) ? url.replace(/\/+$/, '') + '/v1' : url)

export interface ProviderConfig {
  id: string
  name: string
  baseUrl: string | undefined
  apiKey: string
  modelOverride: string | null
}

export interface AiProvider {
  id: string
  name: string
  client: OpenAI
  modelOverride: string | null
}

export type ChainEntry = AiProvider & { primary: boolean }

// Cấu hình từ env: AI_* là provider chính, AI_FALLBACK_* là dự phòng (model dự phòng mặc định = model chính)
// Env config: AI_* primary, AI_FALLBACK_* backup; used whenever the ai_providers table has no enabled row
export function readEnvProviders(config: ConfigService): ProviderConfig[] {
  const out: ProviderConfig[] = []
  const key = config.get<string>('AI_API_KEY')
  if (key)
    out.push({
      id: 'env:primary',
      name: 'Gateway chính (env)',
      baseUrl: withV1(config.get<string>('AI_BASE_URL') || undefined),
      apiKey: key,
      modelOverride: null
    })
  const fbKey = config.get<string>('AI_FALLBACK_API_KEY')
  const fbUrl = withV1(config.get<string>('AI_FALLBACK_BASE_URL') || undefined)
  if (fbKey && fbUrl) {
    const model = config.get<string>('AI_FALLBACK_MODEL') || config.get<string>('AI_MODEL') || DEFAULT_AI_MODEL
    out.push({ id: 'env:fallback', name: 'Gateway dự phòng (env)', baseUrl: fbUrl, apiKey: fbKey, modelOverride: model })
  }
  return out
}

// Danh sách provider đang dùng: bảng ai_providers (admin quản lý, key mã hóa) hoặc env khi bảng trống
// Provider đầu tiên là chính, các provider sau chỉ được thử khi gateway phía trước lỗi
@Injectable()
export class AiProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(AiProviderRegistry.name)
  private readonly cipher: TokenCipher
  private readonly envList: AiProvider[]
  // rows giữ lại cả khi hết hạn / invalidate: `primaryClient()` (đồng bộ) không bao giờ rơi về null trong lúc nạp lại
  private cache: { at: number; rows: AiProvider[] } | null = null
  private readonly downUntil = new Map<string, number>()

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService
  ) {
    this.cipher = new TokenCipher(config.get<string>('CONNECTOR_ENCRYPTION_KEY') || config.get<string>('SESSION_SECRET') || 'dev-connector-key')
    this.envList = this.build(readEnvProviders(config))
  }

  // Nạp sớm để `llm.client` (đồng bộ) đã đúng ngay từ request đầu tiên
  async onModuleInit() {
    await this.load()
  }

  // Admin ghi xong gọi: nạp lại ngay và xóa trạng thái "đang lỗi" để thử lại từ đầu
  invalidate() {
    if (this.cache) this.cache.at = 0
    this.downUntil.clear()
  }

  // Có ít nhất một provider ⇒ bật tính năng AI; trước lần nạp đầu dùng env
  primaryClient(): OpenAI | null {
    return (this.cache?.rows ?? this.envList)[0]?.client ?? null
  }

  // Thứ tự thử: provider khỏe theo priority; tất cả đang lỗi ⇒ thử lại toàn bộ (còn hơn không gọi)
  // preferredId (provider gắn với model) được đưa lên đầu nếu đang bật; chính nó lỗi thì rơi về các provider còn lại
  async chain(preferredId?: string | null): Promise<ChainEntry[]> {
    const rows = await this.load()
    const now = Date.now()
    const healthy = rows.filter((p) => (this.downUntil.get(p.id) ?? 0) <= now)
    const list = [...(healthy.length ? healthy : rows)]
    const at = preferredId ? list.findIndex((p) => p.id === preferredId) : -1
    if (at > 0) list.unshift(...list.splice(at, 1))
    return list.map((p, i) => ({ ...p, primary: i === 0 }))
  }

  markDown(id: string) {
    this.downUntil.set(id, Date.now() + COOLDOWN_MS)
  }

  private async load(): Promise<AiProvider[]> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.rows
    let fromDb: AiProvider[] = []
    try {
      const res = await this.db.query(`SELECT id, name, base_url, api_key_enc, model_override FROM ai_providers WHERE enabled ORDER BY priority, created_at`)
      const configs: ProviderConfig[] = []
      for (const r of res.rows) {
        try {
          configs.push({ id: r.id, name: r.name, baseUrl: withV1(r.base_url), apiKey: this.cipher.decrypt(r.api_key_enc), modelOverride: r.model_override })
        } catch {
          // Khóa mã hóa đổi ⇒ không giải mã được: bỏ provider này, không làm sập cả danh sách
          this.logger.warn(`Provider "${r.name}" không giải mã được API key (CONNECTOR_ENCRYPTION_KEY đã đổi?), bỏ qua`)
        }
      }
      fromDb = this.build(configs)
    } catch (err) {
      this.logger.warn(`Không đọc được ai_providers, dùng cấu hình env: ${(err as Error).message?.slice(0, 120)}`)
    }
    const rows = fromDb.length ? fromDb : this.envList
    this.cache = { at: Date.now(), rows }
    return rows
  }

  // Provider đầu thử lại 1 lần khi lỗi thoáng qua; provider dự phòng không retry (đã có provider khác chờ)
  private build(configs: ProviderConfig[]): AiProvider[] {
    return configs.map((c, i) => ({
      id: c.id,
      name: c.name,
      modelOverride: c.modelOverride,
      client: new OpenAI({ apiKey: c.apiKey, baseURL: c.baseUrl, timeout: TIMEOUT_MS, maxRetries: i === 0 ? 1 : 0 })
    }))
  }
}
