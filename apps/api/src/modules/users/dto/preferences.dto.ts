import { z } from 'zod'
import type { FeaturePreferences } from '@pu/schemas'

// Giá trị runtime đặt tại API (@pu/schemas chỉ import type)
export const DEFAULT_FEATURE_PREFERENCES: FeaturePreferences = {
  feedViewMode: 'list',
  featuredComment: true,
  newPostsPill: true,
  aiSummary: true
}

// PATCH /users/preferences: known flags and default feed layout
export const UpdatePreferencesBodySchema = z
  .object({
    feedViewMode: z.enum(['list', 'focus']),
    featuredComment: z.boolean(),
    newPostsPill: z.boolean(),
    aiSummary: z.boolean()
  })
  .partial()
  .strict()

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesBodySchema>

// Điền mặc định cho preferences cũ / thiếu trường
export function resolveFeaturePreferences(raw: unknown): FeaturePreferences {
  return { ...DEFAULT_FEATURE_PREFERENCES, ...(raw && typeof raw === 'object' ? (raw as Partial<FeaturePreferences>) : {}) }
}
