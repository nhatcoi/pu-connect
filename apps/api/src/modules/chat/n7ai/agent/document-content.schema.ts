import { z } from 'zod'

// Nội dung tài liệu có cấu trúc, dùng chung cho 2 tool tạo tệp thật: Word (.docx) và PDF —
// cùng 1 dữ liệu đầu vào, 2 script Python render ra 2 định dạng khác nhau
export const DocumentTableSchema = z.object({
  headers: z.array(z.string().trim().max(60)).max(8),
  rows: z.array(z.array(z.string().trim().max(200)).max(8)).max(40)
})

export const DocumentSectionSchema = z.object({
  heading: z.string().trim().max(120).optional(),
  level: z.union([z.literal(1), z.literal(2)]).default(1),
  paragraphs: z.array(z.string().trim().max(1200)).max(20).optional(),
  bullets: z.array(z.string().trim().max(300)).max(15).optional(),
  table: DocumentTableSchema.optional()
})

export const DocumentContentSchema = z.object({
  title: z.string().trim().min(1).max(150),
  subtitle: z.string().trim().max(200).optional(),
  sections: z.array(DocumentSectionSchema).min(1).max(30)
})

export type DocumentContent = z.infer<typeof DocumentContentSchema>

// JSON schema tham số cho tool LLM; tiêu đề và mô tả mảng section khác nhau giữa docx/pdf nên truyền riêng
export const documentContentJsonSchema = (opts: { titleDesc: string; sectionsDesc: string }) => ({
  type: 'object',
  properties: {
    title: { type: 'string', description: opts.titleDesc },
    subtitle: { type: 'string', description: 'Dòng phụ (tác giả, khoa, ngày…)' },
    sections: {
      type: 'array',
      description: opts.sectionsDesc,
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string', description: 'Tiêu đề mục' },
          level: { type: 'number', enum: [1, 2], description: '1 = tiêu đề lớn, 2 = tiêu đề phụ' },
          paragraphs: { type: 'array', items: { type: 'string' }, description: 'Các đoạn văn của mục' },
          bullets: { type: 'array', items: { type: 'string' }, description: 'Gạch đầu dòng của mục' },
          table: {
            type: 'object',
            properties: {
              headers: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } }
            },
            description: 'Bảng dữ liệu trong mục (chỉ khi nội dung thực sự dạng bảng)'
          }
        },
        additionalProperties: false
      }
    }
  },
  required: ['title', 'sections'],
  additionalProperties: false
})
