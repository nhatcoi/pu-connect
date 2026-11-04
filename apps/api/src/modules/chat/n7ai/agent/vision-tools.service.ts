import { Injectable, Logger } from '@nestjs/common'
import type { AgentToolSession } from '../../../ai/agent-tools'
import { argText, toolError, toolResult } from '../../../ai/agent-tool-args'
import { LlmService } from '../../../ai/llm.service'

const PROVIDER = 'puc'
const VISION_TOOL = `${PROVIDER}__analyze_image`

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const INSTRUCTIONS = [
  'Image recognition tool (puc__analyze_image) inspects, OCRs, transcribes, or analyzes images from a given URL (public web URL, R2 storage link, or base64 data URI).',
  'Call puc__analyze_image whenever the user provides an image link or requests recognizing text (OCR), solving a math/geometry problem from a photo/diagram, reading a chart/table, or explaining the visual contents of an image.',
  'Specify "focus" as "ocr" when transcription of text or handwriting is needed, "math_diagram" for geometry/equations, "chart_table" for data figures, or "general" for scene and object understanding. Include a concise "prompt" describing what to extract.'
]

const TOOLS: AgentToolSession['tools'] = [
  {
    type: 'function',
    function: {
      name: VISION_TOOL,
      description:
        'Phân tích, nhận diện và trích xuất nội dung từ hình ảnh qua URL (OCR chữ viết tay/chữ in, giải bài tập/sơ đồ hình học, đọc biểu đồ số liệu hoặc mô tả chi tiết hình ảnh).',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Đường dẫn URL của hình ảnh (hỗ trợ HTTP/HTTPS công khai, link R2 storage, hoặc data URI base64)'
          },
          prompt: {
            type: 'string',
            description: 'Yêu cầu cụ thể cần nhận diện hoặc giải đáp từ hình ảnh (ví dụ: "Đọc toàn bộ chữ trong ảnh", "Giải bài toán hình này", "Trích bảng dữ liệu")'
          },
          focus: {
            type: 'string',
            enum: ['general', 'ocr', 'math_diagram', 'chart_table'],
            description: 'Trọng tâm nhận diện: ocr (trích xuất chữ), math_diagram (công thức & sơ đồ), chart_table (biểu đồ số liệu), general (mô tả tổng quan)'
          }
        },
        required: ['url'],
        additionalProperties: false
      }
    }
  }
]

// Công cụ nhận diện hình ảnh N7AI: OCR trích xuất chữ viết, nhận diện công thức/sơ đồ, đọc biểu đồ, phân tích ảnh từ URL
@Injectable()
export class VisionToolsService {
  private readonly logger = new Logger(VisionToolsService.name)

  constructor(private readonly llm: LlmService) {}

  open(userId: string): AgentToolSession {
    return {
      tools: TOOLS,
      readOnly: () => true,
      instructions: INSTRUCTIONS,
      describe: (name, args) => {
        if (name !== VISION_TOOL) return null
        const prompt = argText(args.prompt, 60)
        return { provider: PROVIDER, label: 'Nhận diện hình ảnh', ...(prompt ? { detail: prompt } : {}) }
      },
      call: async (name, args, signal) => {
        if (name !== VISION_TOOL) return toolError('Công cụ không được cấp quyền trong lượt hỏi này')
        const rawUrl = argText(args.url, 2000)
        if (!rawUrl) return toolError('Cần đường dẫn URL hình ảnh để phân tích')

        const client = this.llm.client
        if (!client) return toolError('Dịch vụ AI hiện không khả dụng để nhận diện hình ảnh')

        const focus = (argText(args.focus, 20) || 'general').toLowerCase()
        const userPrompt = argText(args.prompt, 1000) || 'Hãy phân tích chi tiết hình ảnh này.'

        try {
          const imageUrl = await this.prepareImageUrl(rawUrl, signal)

          let systemPrompt =
            'Bạn là chuyên gia thị giác máy tính và nhận diện hình ảnh N7AI. Hãy phân tích hình ảnh được cung cấp một cách chi tiết, chính xác, trung thực.'
          if (focus === 'ocr') {
            systemPrompt +=
              ' Hãy tập trung trích xuất chính xác mọi chữ viết (kể cả chữ in và chữ viết tay), số liệu và nhãn có trong ảnh theo thứ tự đọc tự nhiên. Giữ nguyên định dạng và dấu câu.'
          } else if (focus === 'math_diagram') {
            systemPrompt +=
              ' Hãy nhận diện các công thức toán học, ký hiệu, sơ đồ hình học hoặc hình vẽ khoa học. Trình bày công thức dưới dạng LaTeX chuẩn (đặt trong $...$ hoặc $$...$$) và giải thích các thành phần.'
          } else if (focus === 'chart_table') {
            systemPrompt +=
              ' Hãy nhận diện loại biểu đồ/bảng dữ liệu, các trục, đơn vị đo, chú giải (legend), và trích xuất các mốc dữ liệu nổi bật hoặc chuyển đổi bảng thành định dạng bảng Markdown.'
          }

          const completion = await client.chat.completions.create(
            {
              model: this.llm.model,
              messages: [
                { role: 'system', content: systemPrompt },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: imageUrl } }
                  ]
                }
              ],
              max_tokens: 2500
            },
            { signal }
          )

          const analysis = completion.choices[0]?.message?.content?.trim()
          if (!analysis) return toolError('Không nhận diện được nội dung từ hình ảnh')

          return toolResult('Nhận diện hình ảnh', {
            focus,
            analysis
          })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          this.logger.warn(`Vision recognition failed: ${msg}`)
          return toolError(`Không thể nhận diện hình ảnh: ${msg}`)
        }
      },
      close: async () => undefined
    }
  }

  private async prepareImageUrl(rawUrl: string, signal?: AbortSignal): Promise<string> {
    if (rawUrl.startsWith('data:image/')) {
      return rawUrl
    }

    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      throw new Error('URL hình ảnh không đúng định dạng')
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Chỉ hỗ trợ giao thức http hoặc https')
    }

    // Chống SSRF: không gọi tới localhost / private IP
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      throw new Error('Không được phép truy cập địa chỉ mạng nội bộ')
    }

    const res = await fetch(rawUrl, {
      signal: signal ?? AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'N7AI-VisionBot/1.0'
      }
    })

    if (!res.ok) {
      throw new Error(`Không thể tải ảnh từ URL (HTTP ${res.status})`)
    }

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!ALLOWED_MIME.includes(contentType)) {
      const extMatch = rawUrl.match(/\.(jpe?g|png|webp|gif)(\?.*)?$/i)
      if (!extMatch) {
        throw new Error(`Định dạng tệp không được hỗ trợ (cần JPEG, PNG, WEBP hoặc GIF)`)
      }
    }

    const arrayBuffer = await res.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new Error(`Kích thước ảnh vượt quá giới hạn cho phép (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB)`)
    }

    const mime = ALLOWED_MIME.includes(contentType) ? contentType : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  }
}
