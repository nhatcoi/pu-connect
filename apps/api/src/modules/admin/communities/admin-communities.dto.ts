import { z } from 'zod'

const username = z.string().trim().toLowerCase().min(2).max(50)

export const AdminCreateCommunitySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
    name: z.string().trim().min(3).max(100),
    description: z.string().trim().min(10).max(500),
    communityType: z.enum(['campus', 'faculty', 'academic', 'life', 'club']).default('academic'),
    ownerUsername: username.optional()
  })
  .strict()
export type AdminCreateCommunityBody = z.infer<typeof AdminCreateCommunitySchema>

export const AdminCommunityReviewSchema = z.object({ note: z.string().trim().max(300).optional() }).strict()
export const AdminCommunityOwnerSchema = z.object({ username }).strict()
