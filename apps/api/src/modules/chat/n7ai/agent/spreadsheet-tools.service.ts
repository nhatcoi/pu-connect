import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'node:fs/promises'
import { z } from 'zod'
import type { ChatAttachment } from '@pu/schemas'
import type { AgentToolSession } from '../../../ai/agent-tools'
import { DatabaseService } from '../../../../database/database.service'
import { StorageService } from '../../../storage/storage.service'
import { cleanupFiles, runGeneratorScript, safeFileStem, tempOutPath, writeTempJson } from './file-tool-runtime'

const PROVIDER = 'puc'
const XLSX_TOOL = `${PROVIDER}__create_spreadsheet`
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const SheetSchema = z.object({
  name: z.string().trim().min(1).max(31),
  headers: z.array(z.string().trim().max(60)).max(30).optional(),
  rows: z.array(z.array(z.union([z.string(), z.number()]).transform((v) => String(v))).max(30)).max(500)
})

const SpreadsheetInputSchema = z.object({
  title: z.string().trim().min(1).max(150),
  sheets: z.array(SheetSchema).min(1).max(10)
})

export interface SpreadsheetSession extends AgentToolSession {
  created: () => ChatAttachment | null
}

const INSTRUCTIONS = [
  'Spreadsheet tool (puc__create_spreadsheet) generates a real Excel (.xlsx) file — one or more sheets, each with an optional header row and data rows. Call it when the user asks to tabulate data, build a study schedule/budget/tracker, or export AS AN EXCEL FILE.',
  'One topic = one sheet. Put column names in the first row (headers). Never fabricate data the user did not provide — leave cells blank or ask instead.',
  'After calling the tool, summarize in 1–2 short sentences that the spreadsheet has been generated and attached for preview/download. Do not repeat the raw table in your reply.'
]

const TOOLS: AgentToolSession['tools'] = [
  {
    type: 'function',
    function: {
      name: XLSX_TOOL,
      description: 'Tạo tệp Excel (.xlsx) thật từ dữ liệu: 1 hoặc nhiều sheet, mỗi sheet có tiêu đề cột (tùy chọn) và các dòng dữ liệu. Đính kèm vào tin nhắn để xem trước hoặc tải về.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Tên tệp Excel (dùng để đặt tên tệp)' },
          sheets: {
            type: 'array',
            description: 'Các sheet (1-5 sheet là hợp lý)',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Tên sheet (≤ 31 ký tự)' },
                headers: { type: 'array', items: { type: 'string' }, description: 'Tiêu đề cột, dòng đầu tiên' },
                rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Các dòng dữ liệu, mỗi dòng 1 mảng ô theo đúng thứ tự cột' }
              },
              required: ['name', 'rows'],
              additionalProperties: false
            }
          }
        },
        required: ['title', 'sheets'],
        additionalProperties: false
      }
    }
  }
]

// Tạo tệp Excel thật (openpyxl qua script dùng chung) — không phải bảng Markdown in ra khung chat
@Injectable()
export class SpreadsheetToolsService {
  private readonly logger = new Logger(SpreadsheetToolsService.name)

  constructor(
    private readonly storage: StorageService,
    private readonly db: DatabaseService
  ) {}

  open(userId: string, messageId: string): SpreadsheetSession {
    let createdAttachment: ChatAttachment | null = null

    return {
      tools: TOOLS,
      instructions: INSTRUCTIONS,
      created: () => createdAttachment,
      describe: (name, args) => {
        if (name !== XLSX_TOOL) return null
        const title = typeof args.title === 'string' ? args.title.slice(0, 50) : undefined
        return { provider: PROVIDER, label: 'Tạo bảng tính Excel', ...(title ? { detail: title } : {}) }
      },
      call: async (name, args) => {
        if (name !== XLSX_TOOL) return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        if (createdAttachment) return JSON.stringify({ error: `Lượt này đã tạo bảng tính "${createdAttachment.name}".` })

        const parsed = SpreadsheetInputSchema.safeParse(args)
        if (!parsed.success) {
          return JSON.stringify({ error: 'Tham số bảng tính không hợp lệ', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) })
        }

        try {
          const attachment = await this.generateAndUpload(userId, parsed.data)
          createdAttachment = attachment
          await this.db.query(`UPDATE messages SET attachments = COALESCE(attachments, '[]'::jsonb) || $2::jsonb WHERE id = $1`, [
            messageId,
            JSON.stringify([attachment])
          ])
          return JSON.stringify({
            success: true,
            title: parsed.data.title,
            fileName: attachment.name,
            url: attachment.url,
            message: 'Đã tạo thành công tệp Excel (.xlsx) và đính kèm vào tin nhắn. Thông báo ngắn gọn rằng tệp đã sẵn sàng để xem trước hoặc tải về.'
          })
        } catch (err: any) {
          this.logger.error(`Tạo bảng tính Excel thất bại: ${err?.message}`, err?.stack)
          return JSON.stringify({ error: 'Gặp lỗi khi tạo tệp Excel, vui lòng thử lại sau.' })
        }
      },
      close: async () => undefined
    }
  }

  private async generateAndUpload(userId: string, data: z.infer<typeof SpreadsheetInputSchema>): Promise<ChatAttachment> {
    const jsonPath = await writeTempJson(data, 'xlsx_in')
    const outPath = tempOutPath('xlsx', 'xlsx_out')
    try {
      await runGeneratorScript('generate_spreadsheet.py', ['openpyxl'], [outPath, jsonPath])
      const fileBuffer = await fs.readFile(outPath)
      const fileName = `${safeFileStem(data.title, 'Bang_tinh')}.xlsx`
      const uploaded = await this.storage.uploadFile(fileBuffer, fileName, MIME, 'chat', userId)
      return {
        url: uploaded.url,
        key: uploaded.key,
        name: `${data.title.slice(0, 60)}.xlsx`,
        size: uploaded.size,
        mime: MIME,
        kind: 'file'
      }
    } finally {
      await cleanupFiles(jsonPath, outPath)
    }
  }
}
