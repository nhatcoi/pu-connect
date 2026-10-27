import { z } from 'zod'

const ROLES = ['student', 'lecturer', 'ta', 'club_lead', 'admin'] as const

// Rỗng = mọi thành viên; roles/unitIds/years kết hợp bằng AND, các giá trị trong cùng một mảng bằng OR
export const AnnouncementAudienceSchema = z
  .object({
    roles: z.array(z.enum(ROLES)).max(5).optional(),
    unitIds: z.array(z.string().uuid()).max(50).optional(),
    years: z.array(z.string().trim().min(1).max(20)).max(20).optional()
  })
  .strict()

export const AnnouncementCreateSchema = z
  .object({
    title: z.string().trim().min(3, 'Tiêu đề tối thiểu 3 ký tự').max(120),
    message: z.string().trim().min(5, 'Nội dung tối thiểu 5 ký tự').max(500),
    link: z.string().trim().max(255).optional().nullable(),
    audience: AnnouncementAudienceSchema.default({}),
    sendInApp: z.boolean().default(true),
    banner: z.boolean().default(false),
    bannerUntil: z.string().datetime().optional().nullable(),
    scheduledAt: z.string().datetime().optional().nullable()
  })
  .strict()
  .refine((v) => v.sendInApp || v.banner, { message: 'Chọn ít nhất một kênh: thông báo trong app hoặc banner' })

export const AnnouncementPreviewSchema = z.object({ audience: AnnouncementAudienceSchema.default({}) }).strict()

export const AnnouncementListQuerySchema = z.object({
  status: z.enum(['scheduled', 'sent', 'cancelled']).optional()
})

export type AnnouncementCreate = z.infer<typeof AnnouncementCreateSchema>
export type AnnouncementAudience = z.infer<typeof AnnouncementAudienceSchema>
