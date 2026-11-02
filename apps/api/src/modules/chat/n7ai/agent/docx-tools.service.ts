import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'node:fs/promises'
import type { ChatAttachment } from '@pu/schemas'
import type { AgentToolSession } from '../../../ai/agent-tools'
import { DatabaseService } from '../../../../database/database.service'
import { StorageService } from '../../../storage/storage.service'
import { DocumentContentSchema, documentContentJsonSchema } from './document-content.schema'
import { cleanupFiles, runGeneratorScript, safeFileStem, tempOutPath, writeTempJson } from './file-tool-runtime'

const PROVIDER = 'puc'
const DOCX_TOOL = `${PROVIDER}__create_document`
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface DocxSession extends AgentToolSession {
  created: () => ChatAttachment | null
}

const INSTRUCTIONS = [
  'Document tool (puc__create_document) generates a real Microsoft Word (.docx) file — title, sections with headings, paragraphs, bullet lists, and tables. Call it when the user asks to write/draft/export a report, essay, outline, or cover letter AS A WORD FILE (not when they just want the text printed in chat).',
  'Keep headings short; put the substantive writing in paragraphs/bullets. Use table only for genuinely tabular data. Academic tone, no fabricated citations or numbers.',
  'After calling the tool, summarize in 1–2 short sentences that the document has been generated and attached for preview/download. Do not repeat the document text in your reply.'
]

const TOOLS: AgentToolSession['tools'] = [
  {
    type: 'function',
    function: {
      name: DOCX_TOOL,
      description: 'Tạo tệp Word (.docx) thật: tiêu đề, các mục có tiêu đề phụ, đoạn văn, gạch đầu dòng, bảng. Đính kèm vào tin nhắn để xem trước hoặc tải về.',
      parameters: documentContentJsonSchema({
        titleDesc: 'Tiêu đề tài liệu',
        sectionsDesc: 'Các mục nội dung theo thứ tự (2-15 mục)'
      })
    }
  }
]

// Tạo tệp Word thật (python-docx qua script dùng chung) — không phải chỉ in chữ ra khung chat
@Injectable()
export class DocxToolsService {
  private readonly logger = new Logger(DocxToolsService.name)

  constructor(
    private readonly storage: StorageService,
    private readonly db: DatabaseService
  ) {}

  open(userId: string, messageId: string): DocxSession {
    let createdAttachment: ChatAttachment | null = null

    return {
      tools: TOOLS,
      instructions: INSTRUCTIONS,
      created: () => createdAttachment,
      describe: (name, args) => {
        if (name !== DOCX_TOOL) return null
        const title = typeof args.title === 'string' ? args.title.slice(0, 50) : undefined
        return { provider: PROVIDER, label: 'Tạo tài liệu Word', ...(title ? { detail: title } : {}) }
      },
      call: async (name, args) => {
        if (name !== DOCX_TOOL) return JSON.stringify({ error: 'Công cụ không được cấp quyền trong lượt hỏi này' })
        if (createdAttachment) return JSON.stringify({ error: `Lượt này đã tạo tài liệu "${createdAttachment.name}".` })

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
            message: 'Đã tạo thành công tệp Word (.docx) và đính kèm vào tin nhắn. Thông báo ngắn gọn rằng tệp đã sẵn sàng để xem trước hoặc tải về.'
          })
        } catch (err: any) {
          this.logger.error(`Tạo tài liệu Word thất bại: ${err?.message}`, err?.stack)
          return JSON.stringify({ error: 'Gặp lỗi khi tạo tệp Word, vui lòng thử lại sau.' })
        }
      },
      close: async () => undefined
    }
  }

  private async generateAndUpload(userId: string, data: ReturnType<typeof DocumentContentSchema.parse>): Promise<ChatAttachment> {
    const jsonPath = await writeTempJson(data, 'doc_in')
    const outPath = tempOutPath('docx', 'doc_out')
    try {
      await runGeneratorScript('generate_document.py', ['python-docx'], [outPath, jsonPath])
      const fileBuffer = await fs.readFile(outPath)
      const fileName = `${safeFileStem(data.title, 'Tai_lieu')}.docx`
      const uploaded = await this.storage.uploadFile(fileBuffer, fileName, MIME, 'chat', userId)
      return {
        url: uploaded.url,
        key: uploaded.key,
        name: `${data.title.slice(0, 60)}.docx`,
        size: uploaded.size,
        mime: MIME,
        kind: 'file'
      }
    } finally {
      await cleanupFiles(jsonPath, outPath)
    }
  }
}
