import { z } from 'zod'

// Lý do gợi ý theo dõi (ưu tiên từ trên xuống)
export const FollowSuggestionReasonSchema = z.enum(['follows_you', 'mutual', 'shared_interests', 'same_field', 'popular'])

export const FollowSuggestionSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  role: z.string(),
  interestField: z.string().nullable().optional(),
  isVerified: z.boolean(),
  reason: FollowSuggestionReasonSchema,
  // Người mình theo dõi cũng theo dõi họ (tối đa 3 để hiện avatar)
  mutualCount: z.number(),
  mutuals: z.array(z.object({ username: z.string(), displayName: z.string(), avatarUrl: z.string().nullable().optional() })),
  // Sở thích / kỹ năng trùng (tối đa 3)
  sharedTags: z.array(z.string())
})

export type FollowSuggestionReason = z.infer<typeof FollowSuggestionReasonSchema>
export type FollowSuggestion = z.infer<typeof FollowSuggestionSchema>
