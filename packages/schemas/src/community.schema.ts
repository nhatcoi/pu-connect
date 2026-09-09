import { z } from 'zod'

export const CommunityTypeEnum = z.enum(['campus', 'faculty', 'academic', 'life', 'club'])
export type CommunityType = z.infer<typeof CommunityTypeEnum>

export const CommunityRuleSchema = z.object({
  title: z.string(),
  desc: z.string()
})
export type CommunityRule = z.infer<typeof CommunityRuleSchema>

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
  userRole: z.enum(['admin', 'moderator', 'member']).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional()
})
export type Community = z.infer<typeof CommunitySchema>

export const CreateCommunitySchema = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
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
  role: z.enum(['admin', 'moderator', 'member']),
  joinedAt: z.string()
})
export type CommunityMember = z.infer<typeof CommunityMemberSchema>
