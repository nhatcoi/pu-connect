import { z } from 'zod'
import type { PrivacySettings } from '@pu/schemas'

// API chỉ import type từ @pu/schemas (package trỏ tới src .ts) ⇒ giá trị runtime đặt tại đây
// Runtime values live in the API; @pu/schemas is type-only at runtime

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showEmail: false,
  showStudentId: true,
  showClass: true,
  isPrivateProfile: false,
  showActivityStatus: true,
  personalization: true
}

// PATCH /users/privacy: chỉ nhận đúng các cờ boolean đã biết
export const UpdatePrivacyBodySchema = z
  .object({
    showEmail: z.boolean(),
    showStudentId: z.boolean(),
    showClass: z.boolean(),
    isPrivateProfile: z.boolean(),
    showActivityStatus: z.boolean(),
    personalization: z.boolean()
  })
  .partial()
  .strict()

// Điền mặc định cho privacy_settings cũ / thiếu trường (Fill defaults for legacy rows)
export function resolvePrivacySettings(raw: unknown): PrivacySettings {
  return { ...DEFAULT_PRIVACY_SETTINGS, ...(raw && typeof raw === 'object' ? (raw as Partial<PrivacySettings>) : {}) }
}
