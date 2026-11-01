import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AiServicesConfigService } from '../ai-services-config.service'

// Số chiều cố định của cột vector (document_chunks, post_embeddings); model khác số chiều ⇒ phải đổi migration
export const EMBED_DIM = 1024
const DEFAULT_MODEL = 'qwen3-embedding:0.6b'
const BATCH = 32
const QUERY_TIMEOUT_MS = 3000 // câu hỏi chat: chậm hơn ⇒ bỏ vector, chỉ full-text
const DOCS_TIMEOUT_MS = 120_000
const COOLDOWN_MS = 60_000 // server embedding lỗi ⇒ tạm bỏ qua 1 phút (không cộng độ trễ cho mọi câu hỏi)
const QUERY_CACHE = 200

// Model embedding có chỉ dẫn cho câu truy vấn (Qwen3-Embedding); đoạn tài liệu thì không
const queryPrefix = (model: string) => (/qwen3-embedding/i.test(model) ? 'Instruct: Given a student question, retrieve passages that answer it\nQuery: ' : '')

// Lỗi kết nối / quá tải (thử lại sau) khác lỗi do input (bỏ qua mục đó)
const TRANSIENT_STATUS = new Set([408, 429, 502, 503, 504])
class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly transient: boolean
  ) {
    super(message)
  }
}
const isTransient = (err: unknown) => err instanceof EmbeddingError && err.transient

// pgvector nhận chuỗi '[x,y,…]'
export const toVectorLiteral = (v: number[]) => `[${v.join(',')}]`

// Client embedding OpenAI-compatible (/v1/embeddings): mặc định Ollama trên Mac mini qua SSH tunnel (EMBED_BASE_URL)
// Chưa cấu hình / server tắt ⇒ RAG tự lùi về full-text, worker để dành đoạn chưa có embedding cho lần sau
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name)
  private downUntil = 0
  private cachedModel: string = DEFAULT_MODEL
  private readonly cache = new Map<string, number[]>()

  get enabled(): boolean {
    return true
  }

  // Model đang dùng theo cấu hình gần nhất đã đọc (cập nhật mỗi lần gọi embedQuery / embedEach / currentModel)
  get model(): string {
    return this.cachedModel || DEFAULT_MODEL
  }

  // Đọc lại cấu hình rồi trả model hiện hành: gọi trước khi dùng `model` ở nơi chưa gọi embed (vd. chọn đoạn cần embed lại)
  async currentModel(): Promise<string> {
    return (await this.resolveConf()).model
  }

  private async resolveConf() {
    const conf = this.aiServices
      ? await this.aiServices.getEmbedding()
      : {
          enabled: !!this.config.get('EMBED_BASE_URL'),
          baseUrl: (this.config.get<string>('EMBED_BASE_URL') || '').replace(/\/+$/, ''),
          apiKey: this.config.get<string>('EMBED_API_KEY'),
          model: this.config.get<string>('EMBED_MODEL') || DEFAULT_MODEL
        }
    this.cachedModel = conf.model || DEFAULT_MODEL
    return conf
  }

  constructor(
    private readonly config: ConfigService,
    private readonly aiServices?: AiServicesConfigService
  ) {}

  // Đang dùng được (đã cấu hình, không trong thời gian nghỉ sau lỗi)
  get available(): boolean {
    return Date.now() >= this.downUntil
  }

  // Câu hỏi ⇒ vector; null khi không dùng được (nơi gọi lùi về full-text)
  async embedQuery(text: string): Promise<number[] | null> {
    if (!this.available) return null
    const conf = await this.resolveConf()

    if (!conf.enabled || !conf.baseUrl) return null
    const input = queryPrefix(conf.model) + text.trim().slice(0, 2000)
    const hit = this.cache.get(input)
    if (hit) return hit
    try {
      const [vec] = await this.request(conf.baseUrl, conf.apiKey, conf.model, [input], QUERY_TIMEOUT_MS)
      this.cache.set(input, vec)
      if (this.cache.size > QUERY_CACHE) this.cache.delete(this.cache.keys().next().value as string)
      return vec
    } catch (err: any) {
      this.markDown(err)
      return null
    }
  }

  // Đoạn tài liệu / bài viết ⇒ vector theo lô; null = input bị server từ chối (worker đánh dấu, không chặn cả lô)
  // Lỗi kết nối / quá tải ⇒ ném ra (server coi như tắt, worker thử lại lượt sau). Lô lỗi khác ⇒ thử từng mục để tìm mục hỏng;
  // mục nào cũng lỗi ⇒ lỗi ở server, không phải dữ liệu
  async embedEach(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.available) throw new Error('Embedding server unavailable')
    const conf = await this.resolveConf()

    if (!conf.enabled || !conf.baseUrl) throw new Error('Embedding server disabled')

    const out: (number[] | null)[] = []
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH)
      try {
        out.push(...(await this.request(conf.baseUrl, conf.apiKey, conf.model, batch, DOCS_TIMEOUT_MS)))
      } catch (err) {
        if (isTransient(err)) {
          this.markDown(err)
          throw err
        }
        const single = await Promise.all(
          batch.map((t) =>
            this.request(conf.baseUrl, conf.apiKey, conf.model, [t], DOCS_TIMEOUT_MS).then(
              ([v]) => v,
              (e) => (isTransient(e) ? Promise.reject(e) : null)
            )
          )
        )
        if (single.every((v) => v === null)) {
          this.markDown(err)
          throw err
        }
        out.push(...single)
      }
    }
    return out
  }

  private async request(baseUrl: string, apiKey: string | undefined, model: string, input: string[], timeout: number): Promise<number[][]> {
    let res: Response
    const url = `${baseUrl.replace(/(\/v1)?$/, '/v1')}/embeddings`
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ model, input }),
        signal: AbortSignal.timeout(timeout)
      })
    } catch (err: any) {
      throw new EmbeddingError(`Không kết nối được server embedding: ${err?.message}`, true)
    }
    if (!res.ok) throw new EmbeddingError(`HTTP ${res.status}`, TRANSIENT_STATUS.has(res.status))
    const json = (await res.json()) as { data?: { index: number; embedding: number[] }[] }
    const data = [...(json.data ?? [])].sort((a, b) => a.index - b.index).map((d) => d.embedding)
    if (data.length !== input.length || data.some((v) => v?.length !== EMBED_DIM))
      throw new Error(`Embedding trả sai kích thước (cần ${input.length}×${EMBED_DIM})`)
    return data
  }

  private markDown(err: any) {
    if (Date.now() >= this.downUntil) this.logger.warn(`Embedding server lỗi, tạm dùng full-text ${COOLDOWN_MS / 1000}s: ${err?.message}`)
    this.downUntil = Date.now() + COOLDOWN_MS
  }
}
