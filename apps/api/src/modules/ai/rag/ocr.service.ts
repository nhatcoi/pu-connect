import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PDFParse } from 'pdf-parse'

const DEFAULT_MODEL = 'gemini-3.7-flash-medium'
const PAGE_WIDTH = 1400 // px: đủ nét cho dấu tiếng Việt, ảnh ~300KB
const PAGE_TIMEOUT_MS = 90_000
const MAX_OUTPUT_TOKENS = 4000
const PROMPT =
  'Chép lại chính xác toàn bộ chữ trong ảnh trang tài liệu này (tiếng Việt, giữ nguyên dấu, công thức, code). ' +
  'Chỉ trả văn bản, giữ xuống dòng theo đoạn, tiêu đề mục đứng riêng một dòng, không giải thích, không thêm markdown. Trang không có chữ ⇒ trả rỗng.'

// Gateway giới hạn tần suất ⇒ tài liệu quay lại hàng chờ, thử lại sau (không tính là tệp hỏng)
export class OcrRateLimitedError extends Error {}

// OCR trang PDF scan / chữ rác bằng model vision qua API chat OpenAI-compatible
// Mặc định AI gateway (đo 2026-10-19: gemini-3.7-flash CER 0.5–0.7%, ~12s/trang; qwen2.5vl:7b trên Mac mini 1–7.6%, ~50s/trang)
// Đổi sang Ollama local: OCR_BASE_URL=http://127.0.0.1:11435/v1, OCR_MODEL=qwen2.5vl:7b
@Injectable()
export class OcrService {
  readonly model: string
  readonly maxPages: number
  private readonly url: string | null
  private readonly apiKey: string | undefined

  constructor(config: ConfigService) {
    // Mặc định dùng AI gateway (cần AI_API_KEY); OCR_BASE_URL riêng (vd. Ollama) thì không bắt buộc key
    const own = config.get<string>('OCR_BASE_URL')
    const base = own || (config.get<string>('AI_API_KEY') ? config.get<string>('AI_BASE_URL') : undefined)
    this.apiKey = own ? config.get<string>('OCR_API_KEY') || undefined : config.get<string>('AI_API_KEY')
    this.url = base && config.get<string>('OCR_ENABLED') !== 'false' ? `${base.replace(/\/+$/, '').replace(/(\/v1)?$/, '/v1')}/chat/completions` : null
    this.model = config.get<string>('OCR_MODEL') || DEFAULT_MODEL
    this.maxPages = Number(config.get('OCR_MAX_PAGES') || 30)
  }

  get enabled(): boolean {
    return !!this.url
  }

  // Trang (đánh số từ 1) ⇒ chữ; trang lỗi riêng lẻ bị bỏ qua, 429 dừng cả tài liệu để thử lại sau
  async pdfPages(buf: Buffer, pages: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>()
    if (!this.url || !pages.length) return out
    const parser = new PDFParse({ data: new Uint8Array(buf) })
    try {
      for (const page of pages) {
        const shot = await parser.getScreenshot({ partial: [page], desiredWidth: PAGE_WIDTH, imageDataUrl: false })
        const image = shot.pages[0]?.data
        if (!image) continue
        try {
          out.set(page, await this.image(Buffer.from(image).toString('base64'), 'image/png'))
        } catch (err) {
          if (err instanceof OcrRateLimitedError) throw err
        }
      }
    } finally {
      await parser.destroy()
    }
    return out
  }

  private async image(base64: string, mime: string): Promise<string> {
    const res = await fetch(this.url!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
    })
    if (res.status === 429) throw new OcrRateLimitedError('OCR bị giới hạn tần suất')
    if (!res.ok) throw new Error(`OCR HTTP ${res.status}`)
    const text: string = (await res.json())?.choices?.[0]?.message?.content ?? ''
    return text.replace(/^```\w*\n?|```$/g, '').trim()
  }
}
