import { z } from 'zod'
import type { FeaturePreferences } from '@pu/schemas'

// Giá trị runtime đặt tại API (@pu/schemas chỉ import type)
export const DEFAULT_FEATURE_PREFERENCES: FeaturePreferences = {
  featuredComment: true,
  newPostsPill: true,
  aiSummary: true
}

// PATCH /users/preferences: chỉ nhận cờ boolean đã biết
export const UpdatePreferencesBodySchema = z
  .object({
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
