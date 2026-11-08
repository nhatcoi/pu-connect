import { z } from 'zod'

export const CommunityTypeEnum = z.enum(['campus', 'faculty', 'academic', 'life', 'club'])
export type CommunityType = z.infer<typeof CommunityTypeEnum>

export const CommunityRuleSchema = z.object({
  title: z.string(),
  desc: z.string()
})
export type CommunityRule = z.infer<typeof CommunityRuleSchema>

// Trạng thái duyệt: active công khai · pending chờ admin (chỉ chủ thấy) · rejected bị từ chối
export const CommunityStatusEnum = z.enum(['active', 'pending', 'rejected'])
export type CommunityStatus = z.infer<typeof CommunityStatusEnum>

// Vai trò trong cộng đồng: chủ sở hữu (1 người) · điều hành viên · thành viên
export const CommunityRoleEnum = z.enum(['owner', 'moderator', 'member'])
export type CommunityRole = z.infer<typeof CommunityRoleEnum>

export const CommunitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  communityType: CommunityTypeEnum.default('academic'),
  avatarUrl: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  rules: z.array(CommunityRuleSchema).default([]),
  membersCount: z.number().default(0),
  postsCount: z.number().default(0),
  isMember: z.boolean().default(false),
  userRole: CommunityRoleEnum.nullable().optional(),
  status: CommunityStatusEnum.default('active'),
  reviewNote: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional()
})
export type Community = z.infer<typeof CommunitySchema>

export const CreateCommunitySchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  communityType: CommunityTypeEnum.default('academic'),
  avatarUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  rules: z.array(CommunityRuleSchema).optional()
})
export type CreateCommunityInput = z.infer<typeof CreateCommunitySchema>

export const CommunityMemberSchema = z.object({
  communityId: z.string(),
  userId: z.string(),
  role: CommunityRoleEnum,
  joinedAt: z.string()
})
export type CommunityMember = z.infer<typeof CommunityMemberSchema>

// Dòng danh sách thành viên (trang quản lý)
export interface CommunityMemberItem {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: CommunityRole
  joinedAt: string
}

// Điều hành viên và chủ được sửa phần giới thiệu; tên, slug, loại do admin giữ
export interface UpdateCommunityInput {
  description?: string
  rules?: CommunityRule[]
  avatarUrl?: string | null
  bannerUrl?: string | null
}

// Bài bị điều hành viên ẩn (để khôi phục)
export interface CommunityHiddenPost {
  id: string
  title: string | null
  excerpt: string
  authorName: string
  hiddenAt: string
  hiddenReason: string | null
}

// ── Tính năng riêng của cộng đồng ──

// Bài ghim (gọn: chỉ đủ hiện thẻ + link tới bài)
export interface CommunityPinnedPost {
  id: string
  title: string | null
  snippet: string
  authorName: string
  createdAt: string
  pinnedAt: string
}

// Tài liệu chia sẻ trong cộng đồng (trỏ tới tài liệu trong thư viện)
export interface CommunityDocumentItem {
  id: string
  title: string
  description: string | null
  docType: string | null
  mimeType: string
  fileSize: number
  ownerName: string
  addedByMe: boolean
  addedAt: string
}

// Tài liệu của chính mình có thể đưa vào cộng đồng
export interface CommunityDocumentCandidate {
  id: string
  title: string
  mimeType: string
}

export interface CommunityAskSource {
  index: number
  type: 'post' | 'document'
  id: string
  title: string
}

export interface CommunityAskResult {
  answer: string
  sources: CommunityAskSource[]
}

export const COMMUNITY_ASK_MAX = 500
export const COMMUNITY_PIN_MAX = 3
