import { z } from 'zod'

// Chỉ type từ @pu/schemas; hằng runtime khai báo lại ở đây (xem admin.dto.ts)
export const BOT_ROLES_RUNTIME = ['student', 'lecturer', 'ta'] as const
export const BOT_POST_TYPES_RUNTIME = ['general', 'qa', 'document', 'group_recruit', 'review'] as const

export const BOT_USERNAME = /^[a-zA-Z0-9._]{1,40}$/
const username = z.string().trim().regex(BOT_USERNAME, 'tên bot không hợp lệ')

export const BotAccountCreateSchema = z.object({
  username: z.string().trim().regex(/^[a-z0-9._]{3,30}$/, 'username: chữ thường, số, dấu chấm/gạch dưới (3–30 ký tự)'),
  displayName: z.string().trim().min(2).max(60),
  role: z.enum(BOT_ROLES_RUNTIME),
  faculty: z.string().trim().min(1).max(50),
  bio: z.string().trim().max(300).optional(),
  tone: z.string().trim().max(300).optional(),
  major: z.string().trim().max(80).optional(),
  soul: z.string().trim().max(2000).optional()
})

export const BotAccountUpdateSchema = BotAccountCreateSchema.omit({ username: true })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Cần ít nhất một trường' })

export const MAX_JOB_ROWS = 500
export const MAX_ROW_IMAGES = 8

// Mỗi dòng được kiểm tra riêng: dòng lỗi không làm hỏng cả file
export const BotRowSchema = z.object({
  content: z.string().trim().min(1, 'thiếu nội dung').max(20_000, 'nội dung quá dài'),
  title: z.string().trim().max(200, 'tiêu đề quá dài').optional(),
  images: z.array(z.string().trim().url('URL ảnh không hợp lệ').max(1000)).max(MAX_ROW_IMAGES, `tối đa ${MAX_ROW_IMAGES} ảnh`).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10, 'tối đa 10 thẻ').optional(),
  postType: z.enum(BOT_POST_TYPES_RUNTIME, { message: 'loại bài không hợp lệ' }).optional(),
  visibility: z.enum(['public', 'followers', 'private'], { message: 'chế độ hiển thị không hợp lệ' }).optional(),
  course: z.string().trim().max(60).optional(),
  community: z.string().trim().max(100).optional(),
  pollQuestion: z.string().trim().max(200).optional(),
  pollOptions: z.array(z.string().trim().min(1).max(100)).min(2, 'khảo sát cần ít nhất 2 lựa chọn').max(6).optional(),
  scheduledAt: z.string().datetime({ offset: true, message: 'giờ hẹn không hợp lệ' }).optional()
})
export type BotRow = z.infer<typeof BotRowSchema>

export const BotJobCreateSchema = z.object({
  name: z.string().trim().min(1, 'thiếu tên job').max(120),
  bot: username,
  autoReply: z.boolean(),
  autoReact: z.boolean(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1, 'file không có dòng nào').max(MAX_JOB_ROWS, `tối đa ${MAX_JOB_ROWS} dòng mỗi job`),
  dryRun: z.boolean(),
  spacingMinutes: z.number().int().min(1).max(10_080).optional()
})

export const BotJobPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    autoReply: z.boolean(),
    autoReact: z.boolean(),
    status: z.enum(['active', 'paused'])
  })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Cần ít nhất một trường' })
