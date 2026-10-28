import { z } from 'zod'

// Schemas của @pu/schemas chỉ là type trong API ⇒ khai báo lại zod runtime ở đây
const RuleSchema = z.object({ title: z.string().trim().min(1).max(80), desc: z.string().trim().max(300) })
const ImageUrl = z.string().trim().url().max(500)

// Người dùng thường chỉ tạo được các loại này; campus/faculty do admin giữ
export const USER_COMMUNITY_TYPES = ['academic', 'life', 'club'] as const

export const CreateCommunityBodySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
    name: z.string().trim().min(3, 'Tên tối thiểu 3 ký tự').max(100),
    description: z.string().trim().min(10, 'Mô tả tối thiểu 10 ký tự').max(500),
    communityType: z.enum(USER_COMMUNITY_TYPES).default('academic'),
    rules: z.array(RuleSchema).max(10).optional()
  })
  .strict()
export type CreateCommunityBody = z.infer<typeof CreateCommunityBodySchema>

export const UpdateCommunityBodySchema = z
  .object({
    description: z.string().trim().min(10).max(500).optional(),
    rules: z.array(RuleSchema).max(10).optional(),
    avatarUrl: ImageUrl.nullable().optional(),
    bannerUrl: ImageUrl.nullable().optional()
  })
  .strict()
export type UpdateCommunityBody = z.infer<typeof UpdateCommunityBodySchema>

export const MemberRoleBodySchema = z.object({ role: z.enum(['moderator', 'member']) }).strict()
export const HidePostBodySchema = z.object({ reason: z.string().trim().max(300).optional() }).strict()
export const MembersQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0)
})
export type MembersQuery = z.infer<typeof MembersQuerySchema>

// Điều kiện lập cộng đồng: tài khoản đã xác thực hoặc đủ điểm uy tín; mỗi người tối đa N cộng đồng (chờ duyệt + đang hoạt động)
export const COMMUNITY_MIN_REPUTATION = 300
export const COMMUNITY_MAX_OWNED = 3
