import { Injectable, Logger } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { ChatAttachment } from '@pu/schemas'
import type { AgentToolSession } from '../../../ai/agent-tools'
import { DatabaseService } from '../../../../database/database.service'
import { StorageService } from '../../../storage/storage.service'

const execFileAsync = promisify(execFile)

const PROVIDER = 'puc'
const PRESENTATION_TOOL = `${PROVIDER}__create_presentation`

export interface PresentationSession extends AgentToolSession {
  created: () => ChatAttachment | null
}

const SlideItemSchema = z.object({
  layout: z.enum(['section', 'bullets', 'two_col', 'stats', 'table', 'closing']).default('bullets'),
  title: z.string().trim().min(1).max(100),
  kicker: z.string().trim().max(40).optional(),
  bullets: z.array(z.string().trim().max(300)).max(8).optional(),
  leftHead: z.string().trim().max(80).optional(),
  leftBullets: z.array(z.string().trim().max(300)).max(6).optional(),
  rightHead: z.string().trim().max(80).optional(),
  rightBullets: z.array(z.string().trim().max(300)).max(6).optional(),
  stats: z
    .array(
      z.object({
        value: z.string().trim().max(30),
        label: z.string().trim().max(60)
      })
    )
    .max(4)
    .optional(),
  table: z
    .object({
      headers: z.array(z.string().trim().max(60)).max(6),
      rows: z.array(z.array(z.string().trim().max(100)).max(6)).max(10)
    })
    .optional(),
  closingText: z.string().trim().max(80).optional(),
  closingSub: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(1000).optional()
})

const PresentationInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).optional(),
  slides: z.array(SlideItemSchema).min(1).max(20)
})

export type PresentationInput = z.infer<typeof PresentationInputSchema>

const INSTRUCTIONS = [
  'Presentation tool (puc__create_presentation) generates an official, professionally branded PowerPoint (.pptx) presentation following Trường Đại học Phenikaa template (Navy #223771, Orange #F26522, 16:9, Times New Roman, vector hex graphics, Phenikaa header logo & footer URL).',
  'Call this tool whenever the user asks to generate, design, or export slides, PowerPoint, presentations, or mentions /slide, /phenikaa-slides, or "tạo slide".',
  'Slide structure: Title slide (IN HOA) -> Overview/Agenda -> Core content (combine bullets, two_col, stats, table) -> Conclusion/Closing.',
  'Keep titles concise (≤ 45 characters so it does not collide with the top-right Phenikaa logo). Avoid wall of text (≤ 5 bullets per slide).',
  'After calling the tool, summarize in 1–2 short sentences that the slide deck has been generated according to Phenikaa template and attached for direct in-app preview or download. Do not repeat raw slide texts in your reply.'
]

const TOOLS: AgentToolSession['tools'] = [
  {
    type: 'function',
    function: {
      name: PRESENTATION_TOOL,
      description:
        'Tạo bộ slide PowerPoint (.pptx) chuẩn mẫu Đại học Phenikaa (bìa navy, hoa văn lục giác, thanh cam, font Times New Roman, logo Phenikaa). Tự động đính kèm tệp vào tin nhắn để xem trước hoặc tải về.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Tiêu đề bài thuyết trình (IN HOA, ≤ 80 ký tự). VD: "ỨNG DỤNG TRÍ TUỆ NHÂN TẠO TRONG Y TẾ"'
          },
          subtitle: {
            type: 'string',
            description: 'Dòng phụ (nhóm tác giả, khoa, giảng viên, ngày). VD: "Khoa CNTT · Trường Đại học Phenikaa"'
          },
          slides: {
            type: 'array',
            description: 'Danh sách các slide nội dung (3-15 slide)',
            items: {
              type: 'object',
              properties: {
                layout: {
                  type: 'string',
                  enum: ['section', 'bullets', 'two_col', 'stats', 'table', 'closing'],
                  description:
                    'Bố cục slide: section (chương/mục), bullets (gạch đầu dòng), two_col (so sánh 2 cột), stats (số liệu thống kê lớn), table (bảng dữ liệu), closing (kết thúc/cảm ơn)'
                },
                title: { type: 'string', description: 'Tiêu đề slide (ngắn gọn ≤ 45 ký tự để không đè logo)' },
                kicker: { type: 'string', description: 'Tên phần/chương nhỏ phía trên cho layout section (VD: "PHẦN 1")' },
                bullets: { type: 'array', items: { type: 'string' }, description: 'Các ý gạch đầu dòng (layout bullets, 3-5 ý)' },
                leftHead: { type: 'string', description: 'Tiêu đề cột trái (layout two_col)' },
                leftBullets: { type: 'array', items: { type: 'string' }, description: 'Nội dung cột trái (layout two_col)' },
                rightHead: { type: 'string', description: 'Tiêu đề cột phải (layout two_col)' },
                rightBullets: { type: 'array', items: { type: 'string' }, description: 'Nội dung cột phải (layout two_col)' },
                stats: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', description: 'Số lớn nổi bật, VD: "95%", "1.2s", "10,000+"' },
                      label: { type: 'string', description: 'Mô tả ngắn cho số liệu' }
                    },
                    required: ['value', 'label']
                  },
                  description: 'Các chỉ số số liệu lớn nổi bật (layout stats, 2-4 chỉ số)'
                },
                table: {
                  type: 'object',
                  properties: {
                    headers: { type: 'array', items: { type: 'string' } },
                    rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } }
                  },
                  description: 'Bảng dữ liệu (layout table)'
                },
                closingText: { type: 'string', description: 'Tiêu đề slide kết thúc (mặc định "Xin cảm ơn!")' },
                closingSub: { type: 'string', description: 'Dòng phụ slide kết thúc (VD: "Q&A · Xin mời đặt câu hỏi")' },
                notes: { type: 'string', description: 'Ghi chú thuyết minh (Speaker Notes)' }
              },
              required: ['layout', 'title']
            }
          }
        },
        required: ['title', 'slides'],
        additionalProperties: false
      }
    }
  }
]

@Injectable()
export class PresentationToolsService {
  private readonly logger = new Logger(PresentationToolsService.name)

  constructor(
    private readonly storage: StorageService,
    private readonly db: DatabaseService
  ) {}

  open(userId: string, messageId: string): PresentationSession {
    let createdAttachment: ChatAttachment | null = null

    return {
      tools: TOOLS,
      instructions: INSTRUCTIONS,
      created: () => createdAttachment,
      describe: (name, args) => {
        if (name !== PRESENTATION_TOOL) return null
        const title = typeof args.title === 'string' ? args.title.slice(0, 50) : undefined
        return {
          provider: PROVIDER,
          label: 'Tạo slide Phenikaa',
          ...(title ? { detail: title } : {})
        }
      },
      call: async (name, args) => {
        if (name !== PRESENTATION_TOOL) {
          return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        }
        if (createdAttachment) {
          return JSON.stringify({ error: `Lượt này đã tạo bài thuyết trình "${createdAttachment.name}".` })
        }

        const parsed = PresentationInputSchema.safeParse(args)
        if (!parsed.success) {
          return JSON.stringify({
            error: 'Tham số slide không hợp lệ',
            issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
          })
        }

        try {
          const attachment = await this.generateAndUpload(userId, parsed.data)
          createdAttachment = attachment

          // Cập nhật ngay attachment vào tin nhắn trong CSDL
          await this.db.query(
            `UPDATE messages 
             SET attachments = COALESCE(attachments, '[]'::jsonb) || $2::jsonb 
             WHERE id = $1`,
            [messageId, JSON.stringify([attachment])]
          )

          return JSON.stringify({
            success: true,
            title: parsed.data.title,
            slideCount: parsed.data.slides.length + 1, // +1 vì có slide bìa
            fileName: attachment.name,
            url: attachment.url,
            message:
              'Đã tạo thành công bộ slide thuyết trình .pptx chuẩn mẫu Đại học Phenikaa và đính kèm vào tin nhắn. Hãy thông báo ngắn gọn 1-2 câu rằng slide đã được đính kèm để người dùng xem trước trực tiếp hoặc tải về.'
          })
        } catch (err: any) {
          this.logger.error(`Tạo slide Phenikaa thất bại: ${err?.message}`, err?.stack)
          return JSON.stringify({
            error: 'Gặp lỗi khi tạo file slide PowerPoint, vui lòng thử lại sau.'
          })
        }
      },
      close: async () => undefined
    }
  }

  private resolveTemplatePath(): string {
    const candidates = [
      path.resolve(process.cwd(), 'phenika-slide-template.pptx'),
      path.resolve(process.cwd(), 'apps/api/templates/phenika-slide-template.pptx'),
      path.resolve(__dirname, '../../../../templates/phenika-slide-template.pptx'),
      path.resolve(__dirname, '../../../../../phenika-slide-template.pptx')
    ]
    for (const p of candidates) {
      try {
        if (existsSync(p)) return p
      } catch {
        // continue
      }
    }
    return candidates[0]
  }

  private resolveScriptPath(): string {
    const candidates = [
      path.resolve(process.cwd(), 'scripts/generate_phenikaa_deck.py'),
      path.resolve(__dirname, '../../../../../../scripts/generate_phenikaa_deck.py'),
      path.resolve(__dirname, 'generate_phenikaa_deck.py')
    ]
    for (const p of candidates) {
      try {
        if (existsSync(p)) return p
      } catch {
        // continue
      }
    }
    return candidates[0]
  }

  private async generateAndUpload(userId: string, data: PresentationInput): Promise<ChatAttachment> {
    const templatePath = this.resolveTemplatePath()
    const scriptPath = this.resolveScriptPath()

    const tempDir = os.tmpdir()
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const jsonPath = path.join(tempDir, `deck_input_${id}.json`)
    const outPath = path.join(tempDir, `deck_out_${id}.pptx`)

    await fs.writeFile(jsonPath, JSON.stringify(data), 'utf-8')

    try {
      // Ưu tiên chạy qua uv nếu có, nếu không thì dùng python3
      let cmd = 'uv'
      let args = ['run', '--with', 'python-pptx', 'python3', scriptPath, templatePath, outPath, jsonPath]

      try {
        await execFileAsync('which', ['uv'])
      } catch {
        cmd = 'python3'
        args = [scriptPath, templatePath, outPath, jsonPath]
      }

      await execFileAsync(cmd, args, { timeout: 30_000 })

      const fileBuffer = await fs.readFile(outPath)

      const safeTitle = data.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 50)

      const fileName = `${safeTitle || 'Slide_Phenikaa'}.pptx`
      const uploaded = await this.storage.uploadFile(
        fileBuffer,
        fileName,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'chat',
        userId
      )

      return {
        url: uploaded.url,
        key: uploaded.key,
        name: `${data.title.slice(0, 45)}.pptx`,
        size: uploaded.size,
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        kind: 'file'
      }
    } finally {
      // Dọn dẹp file tạm
      await fs.unlink(jsonPath).catch(() => undefined)
      await fs.unlink(outPath).catch(() => undefined)
    }
  }
}
