import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  AdminAiServiceItem,
  AdminAiServicePatch,
  AdminAiServicesOverview,
  AdminAiServiceTestResult,
  AiServiceType
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { TokenCipher } from './connectors/token-cipher'

interface CachedServiceConfig {
  enabled: boolean
  baseUrl: string
  apiKey?: string
  model: string
  maxPages: number
  keyHint: string
  updatedAt: string
}

@Injectable()
export class AiServicesConfigService implements OnModuleInit {
  private readonly logger = new Logger(AiServicesConfigService.name)
  private readonly cipher: TokenCipher
  private readonly cache = new Map<AiServiceType, { config: CachedServiceConfig; expiresAt: number }>()

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {
    this.cipher = new TokenCipher(
      config.get<string>('CONNECTOR_ENCRYPTION_KEY') || config.get<string>('SESSION_SECRET') || 'dev-connector-key'
    )
  }

  async onModuleInit() {
    await this.ensureSeed()
  }

  private async ensureSeed() {
    try {
      // Seed từ env nếu trong DB chưa có key
      const ocrKey = this.config.get<string>('OCR_API_KEY') || this.config.get<string>('AI_API_KEY')
      if (ocrKey) {
        const row = await this.db.query<{ api_key_enc: string | null }>(
          `SELECT api_key_enc FROM ai_services WHERE service = 'ocr'`
        )
        if (row.rowCount && !row.rows[0].api_key_enc) {
          await this.db.query(
            `UPDATE ai_services SET api_key_enc = $1, key_hint = $2, updated_at = NOW() WHERE service = 'ocr'`,
            [this.cipher.encrypt(ocrKey), ocrKey.slice(-4)]
          )
        }
      }
    } catch {
      // Bỏ qua nếu bảng chưa tạo (migration chạy sau)
    }
  }

  private async fetchService(service: AiServiceType): Promise<CachedServiceConfig> {
    const cached = this.cache.get(service)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.config
    }

    const res = await this.db.query(
      `SELECT service, name, enabled, base_url, api_key_enc, key_hint, model, max_pages, updated_at 
       FROM ai_services WHERE service = $1`,
      [service]
    )

    if (!res.rowCount) {
      // Fallback về env nếu DB chưa có
      if (service === 'embedding') {
        const base = this.config.get<string>('EMBED_BASE_URL') || 'http://127.0.0.1:11435/v1'
        const key = this.config.get<string>('EMBED_API_KEY')
        const model = this.config.get<string>('EMBED_MODEL') || 'qwen3-embedding:0.6b'
        const conf: CachedServiceConfig = {
          enabled: true,
          baseUrl: base,
          apiKey: key || undefined,
          model,
          maxPages: 30,
          keyHint: key ? key.slice(-4) : '',
          updatedAt: new Date().toISOString()
        }
        this.cache.set(service, { config: conf, expiresAt: Date.now() + 10_000 })
        return conf
      } else {
        const base = this.config.get<string>('OCR_BASE_URL') || 'https://api-ai.vnhat.dev/v1'
        const key = this.config.get<string>('OCR_API_KEY') || this.config.get<string>('AI_API_KEY')
        const model = this.config.get<string>('OCR_MODEL') || 'gemini-3.7-flash-medium'
        const maxPages = Number(this.config.get('OCR_MAX_PAGES') || 30)
        const conf: CachedServiceConfig = {
          enabled: true,
          baseUrl: base,
          apiKey: key || undefined,
          model,
          maxPages,
          keyHint: key ? key.slice(-4) : '',
          updatedAt: new Date().toISOString()
        }
        this.cache.set(service, { config: conf, expiresAt: Date.now() + 10_000 })
        return conf
      }
    }

    const row = res.rows[0]
    let apiKey: string | undefined
    if (row.api_key_enc) {
      try {
        apiKey = this.cipher.decrypt(row.api_key_enc)
      } catch (err) {
        this.logger.error(`Không giải mã được key dịch vụ ${service}`, err)
      }
    }

    const config: CachedServiceConfig = {
      enabled: row.enabled,
      baseUrl: row.base_url || '',
      apiKey,
      model: row.model || '',
      maxPages: row.max_pages || 30,
      keyHint: row.key_hint || '',
      updatedAt: row.updated_at.toISOString()
    }

    this.cache.set(service, { config, expiresAt: Date.now() + 15_000 })
    return config
  }

  async getEmbedding() {
    const c = await this.fetchService('embedding')
    return {
      enabled: c.enabled && !!c.baseUrl,
      baseUrl: c.baseUrl.replace(/\/+$/, ''),
      apiKey: c.apiKey,
      model: c.model || 'qwen3-embedding:0.6b'
    }
  }

  async getOcr() {
    const c = await this.fetchService('ocr')
    return {
      enabled: c.enabled && !!c.baseUrl,
      baseUrl: c.baseUrl.replace(/\/+$/, ''),
      apiKey: c.apiKey,
      model: c.model || 'gemini-3.7-flash-medium',
      maxPages: c.maxPages || 30
    }
  }

  async list(): Promise<AdminAiServicesOverview> {
    const [emb, ocr] = await Promise.all([
      this.fetchService('embedding'),
      this.fetchService('ocr')
    ])

    return {
      embedding: {
        service: 'embedding',
        name: 'RAG',
        enabled: emb.enabled,
        baseUrl: emb.baseUrl,
        keyHint: emb.keyHint,
        model: emb.model,
        updatedAt: emb.updatedAt
      },
      ocr: {
        service: 'ocr',
        name: 'OCR',
        enabled: ocr.enabled,
        baseUrl: ocr.baseUrl,
        keyHint: ocr.keyHint,
        model: ocr.model,
        maxPages: ocr.maxPages,
        updatedAt: ocr.updatedAt
      }
    }
  }

  async update(service: AiServiceType, patch: AdminAiServicePatch): Promise<AdminAiServiceItem> {
    if (!['embedding', 'ocr'].includes(service)) {
      throw new NotFoundException(`Dịch vụ không tồn tại: ${service}`)
    }

    const sets: string[] = ['updated_at = NOW()']
    const params: any[] = [service]
    let idx = 2

    if (patch.enabled !== undefined) {
      sets.push(`enabled = $${idx++}`)
      params.push(patch.enabled)
    }

    if (patch.baseUrl !== undefined) {
      sets.push(`base_url = $${idx++}`)
      params.push(patch.baseUrl.trim().replace(/\/+$/, ''))
    }

    if (patch.model !== undefined) {
      sets.push(`model = $${idx++}`)
      params.push(patch.model.trim())
    }

    if (patch.maxPages !== undefined && service === 'ocr') {
      sets.push(`max_pages = $${idx++}`)
      params.push(Math.max(1, Math.min(patch.maxPages, 100)))
    }

    if (patch.apiKey !== undefined) {
      const key = patch.apiKey.trim()
      if (key) {
        sets.push(`api_key_enc = $${idx++}`)
        params.push(this.cipher.encrypt(key))
        sets.push(`key_hint = $${idx++}`)
        params.push(key.slice(-4))
      } else {
        sets.push(`api_key_enc = NULL`)
        sets.push(`key_hint = ''`)
      }
    }

    await this.db.query(
      `UPDATE ai_services SET ${sets.join(', ')} WHERE service = $1`,
      params
    )

    this.cache.delete(service)
    const list = await this.list()
    return list[service]
  }

  async test(service: AiServiceType): Promise<AdminAiServiceTestResult> {
    const started = Date.now()
    try {
      if (service === 'embedding') {
        const c = await this.getEmbedding()
        if (!c.baseUrl) return { ok: false, latencyMs: 0, error: 'Chưa cấu hình Base URL' }

        const url = `${c.baseUrl.replace(/(\/v1)?$/, '/v1')}/embeddings`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {})
          },
          body: JSON.stringify({
            model: c.model,
            input: 'ping'
          }),
          signal: AbortSignal.timeout(8000)
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { ok: false, latencyMs: Date.now() - started, error: `HTTP ${res.status}: ${text.slice(0, 100)}` }
        }

        return { ok: true, latencyMs: Date.now() - started }
      } else {
        const c = await this.getOcr()
        if (!c.baseUrl) return { ok: false, latencyMs: 0, error: 'Chưa cấu hình Base URL' }

        const url = `${c.baseUrl.replace(/(\/v1)?$/, '/v1')}/chat/completions`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {})
          },
          body: JSON.stringify({
            model: c.model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5
          }),
          signal: AbortSignal.timeout(8000)
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          return { ok: false, latencyMs: Date.now() - started, error: `HTTP ${res.status}: ${text.slice(0, 100)}` }
        }

        return { ok: true, latencyMs: Date.now() - started }
      }
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - started, error: err?.message || 'Lỗi kết nối' }
    }
  }
}
