import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'node:fs/promises'
import type { ChatAttachment } from '@pu/schemas'
import type { AgentToolSession } from '../../../ai/agent-tools'
import { DatabaseService } from '../../../../database/database.service'
import { StorageService } from '../../../storage/storage.service'
import { DocumentContentSchema, documentContentJsonSchema } from './document-content.schema'
import { cleanupFiles, repoScriptPath, runGeneratorScript, safeFileStem, tempOutPath, writeTempJson } from './file-tool-runtime'

const PROVIDER = 'puc'
const PDF_TOOL = `${PROVIDER}__create_pdf_report`
const MIME = 'application/pdf'

export interface PdfReportSession extends AgentToolSession {
  created: () => ChatAttachment | null
}

const INSTRUCTIONS = [
  'PDF tool (puc__create_pdf_report) generates a real PDF file — title, sections with headings, paragraphs, bullet lists, and tables. Call it when the user asks to export a report/summary/handout AS A PDF FILE.',
  'This tool CREATES a new PDF from content; it does not read an existing PDF (attached PDFs are already readable from the conversation — no tool call needed to read them).',
  'Keep content concise; long walls of text paginate poorly. After calling the tool, summarize in 1–2 short sentences that the PDF has been generated and attached for preview/download. Do not repeat the document text in your reply.'
]

const TOOLS: AgentToolSession['tools'] = [
  {
    type: 'function',
    function: {
      name: PDF_TOOL,
      description: 'Tạo tệp PDF thật từ nội dung: tiêu đề, các mục có tiêu đề phụ, đoạn văn, gạch đầu dòng, bảng. Đính kèm vào tin nhắn để xem trước hoặc tải về. KHÔNG dùng để đọc PDF đã có sẵn.',
      parameters: documentContentJsonSchema({
        titleDesc: 'Tiêu đề báo cáo/tài liệu PDF',
        sectionsDesc: 'Các mục nội dung theo thứ tự (2-15 mục)'
      })
    }
  }
]

// Tạo tệp PDF thật (ReportLab qua script dùng chung, font DejaVu nhúng sẵn cho tiếng Việt)
@Injectable()
export class PdfReportToolsService {
  private readonly logger = new Logger(PdfReportToolsService.name)

  constructor(
    private readonly storage: StorageService,
    private readonly db: DatabaseService
  ) {}

  open(userId: string, messageId: string): PdfReportSession {
    let createdAttachment: ChatAttachment | null = null

    return {
      tools: TOOLS,
      instructions: INSTRUCTIONS,
      created: () => createdAttachment,
      describe: (name, args) => {
        if (name !== PDF_TOOL) return null
        const title = typeof args.title === 'string' ? args.title.slice(0, 50) : undefined
        return { provider: PROVIDER, label: 'Tạo báo cáo PDF', ...(title ? { detail: title } : {}) }
      },
      call: async (name, args) => {
        if (name !== PDF_TOOL) return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        if (createdAttachment) return JSON.stringify({ error: `Lượt này đã tạo tệp PDF "${createdAttachment.name}".` })

        const parsed = DocumentContentSchema.safeParse(args)
        if (!parsed.success) {
          return JSON.stringify({ error: 'Tham số tài liệu không hợp lệ', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) })
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
            message: 'Đã tạo thành công tệp PDF và đính kèm vào tin nhắn. Thông báo ngắn gọn rằng tệp đã sẵn sàng để xem trước hoặc tải về.'
          })
        } catch (err: any) {
          this.logger.error(`Tạo tệp PDF thất bại: ${err?.message}`, err?.stack)
          return JSON.stringify({ error: 'Gặp lỗi khi tạo tệp PDF, vui lòng thử lại sau.' })
        }
      },
      close: async () => undefined
    }
  }

  private async generateAndUpload(userId: string, data: ReturnType<typeof DocumentContentSchema.parse>): Promise<ChatAttachment> {
    const jsonPath = await writeTempJson(data, 'pdf_in')
    const outPath = tempOutPath('pdf', 'pdf_out')
    const fontDir = repoScriptPath('fonts')
    try {
      await runGeneratorScript('generate_pdf_report.py', ['reportlab'], [outPath, jsonPath, fontDir])
      const fileBuffer = await fs.readFile(outPath)
      const fileName = `${safeFileStem(data.title, 'Bao_cao')}.pdf`
      const uploaded = await this.storage.uploadFile(fileBuffer, fileName, MIME, 'chat', userId)
      return {
        url: uploaded.url,
        key: uploaded.key,
        name: `${data.title.slice(0, 60)}.pdf`,
        size: uploaded.size,
        mime: MIME,
        kind: 'file'
      }
    } finally {
      await cleanupFiles(jsonPath, outPath)
    }
  }
}
