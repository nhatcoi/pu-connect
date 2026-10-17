import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Email không hợp lệ' }),
  // Username tùy chọn: bỏ trống thì server tự sinh từ email
  username: z
    .string()
    .min(3, { message: 'Username phải có ít nhất 3 ký tự' })
    .max(30, { message: 'Username tối đa 30 ký tự' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username chỉ chứa chữ cái, số và dấu gạch dưới' })
    .optional(),
  displayName: z.string().trim().min(1, { message: 'Vui lòng nhập họ tên' }).max(50, { message: 'Họ tên tối đa 50 ký tự' }),
  // bcrypt chỉ dùng 72 byte đầu
  password: z.string().min(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' }).max(72, { message: 'Mật khẩu tối đa 72 ký tự' }),
  studentId: z.string().optional(),
  faculty: z.string().optional(),
  academicYear: z.string().optional()
})

export const LoginSchema = z.object({
  emailOrUsername: z.string().min(1, { message: 'Vui lòng nhập Email hoặc Username' }),
  password: z.string().min(1, { message: 'Vui lòng nhập mật khẩu' })
})

export const OnboardingSchema = z.object({
  studentId: z.string().min(2, { message: 'Vui lòng nhập Mã sinh viên hoặc Mã cán bộ' }),
  school: z.string().optional().nullable(),
  faculty: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  className: z.string().optional().nullable(),
  academicYear: z.string().min(2, { message: 'Vui lòng chọn Khóa học / Niên khóa' }),
  courses: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  bio: z.string().max(250).optional(),
  followUserIds: z.array(z.string()).default([])
})

export const PrivacySettingsSchema = z.object({
  showEmail: z.boolean().default(false),
  showStudentId: z.boolean().default(true),
  showClass: z.boolean().default(true),
  isPrivateProfile: z.boolean().default(false),
  // Hiện "Đang hoạt động" cho người cùng hội thoại (tắt ⇒ cũng không thấy của người khác)
  showActivityStatus: z.boolean().default(true),
  // Dùng hành vi (bài đã xem, tìm kiếm, tương tác) để gợi ý; tắt ⇒ xóa dữ liệu hành vi
  personalization: z.boolean().default(true),
  // Tab hoạt động trên hồ sơ: người khác xem được (chủ hồ sơ luôn xem được)
  showLikedPosts: z.boolean().default(false),
  showSavedPosts: z.boolean().default(false),
  showCommentedPosts: z.boolean().default(true)
})

// Tùy chọn tính năng (Feature plugs): chỉ ảnh hưởng trải nghiệm của chính mình
export const FeaturePreferencesSchema = z.object({
  // Bảng tin: 1 bình luận nổi bật dưới mỗi bài (tắt ⇒ server bỏ luôn query)
  featuredComment: z.boolean().default(true),
  // Bảng tin: pill "N bài mới" (tắt ⇒ dừng polling + socket)
  newPostsPill: z.boolean().default(true),
  // N7AI: nút "✨ Tóm tắt" trên bài dài
  aiSummary: z.boolean().default(true)
})

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  studentId: z.string().optional().nullable(),
  school: z.string().max(100).optional().nullable(),
  faculty: z.string().optional().nullable(),
  academicYear: z.string().optional().nullable(), // e.g. "K16", "K17"
  major: z.string().optional().nullable(),
  className: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  website: z.string().url().or(z.string().max(255)).optional().nullable(),
  birthDate: z.string().max(50).optional().nullable(),
  bio: z.string().max(250).optional().nullable(),
  role: z.enum(['student', 'lecturer', 'ta', 'club_lead', 'alumni', 'admin']).default('student'),
  status: z.enum(['active', 'suspended', 'pending_verification']).optional(), // suspended ⇒ chặn đăng nhập
  reputationPoints: z.number().default(0),
  isEmailVerified: z.boolean().optional(), // email đã xác thực
  isOnboarded: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  verifiedAt: z.string().optional().nullable(),
  privacySettings: PrivacySettingsSchema.default({
    showEmail: false,
    showStudentId: true,
    showClass: true,
    isPrivateProfile: false,
    showActivityStatus: true,
    personalization: true,
    showLikedPosts: false,
    showSavedPosts: false,
    showCommentedPosts: true
  }),
  preferences: FeaturePreferencesSchema.default({ featuredComment: true, newPostsPill: true, aiSummary: true }),
  skills: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  createdAt: z.string()
})

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1, 'Tên không được để trống').max(50).optional(),
  bio: z.string().max(250).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  school: z.string().max(100).optional().nullable(),
  faculty: z.string().max(100).optional().nullable(),
  major: z.string().max(100).optional().nullable(),
  academicYear: z.string().max(20).optional().nullable(),
  className: z.string().max(50).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  birthDate: z.string().max(50).optional().nullable(),
  skills: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional()
})

export const UpdatePrivacySettingsSchema = PrivacySettingsSchema.partial()

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type OnboardingInput = z.infer<typeof OnboardingSchema>
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>

// Tab hoạt động trên hồ sơ (bài đã thích / đã lưu / đã bình luận)
export const PROFILE_ACTIVITY_TYPES = ['liked', 'saved', 'commented'] as const
export type ProfileActivityType = (typeof PROFILE_ACTIVITY_TYPES)[number]
export type FeaturePreferences = z.infer<typeof FeaturePreferencesSchema>
export type FeaturePreferenceKey = keyof FeaturePreferences

// Điền mặc định cho privacy_settings cũ / thiếu trường (Fill defaults for legacy rows)
export function resolvePrivacySettings(raw: unknown): PrivacySettings {
  const parsed = PrivacySettingsSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : PrivacySettingsSchema.parse({})
}
// Điền mặc định cho preferences cũ / thiếu trường
export function resolveFeaturePreferences(raw: unknown): FeaturePreferences {
  const parsed = FeaturePreferencesSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : FeaturePreferencesSchema.parse({})
}
export type UserProfile = z.infer<typeof UserProfileSchema>
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type UpdatePrivacySettingsInput = z.infer<typeof UpdatePrivacySettingsSchema>
