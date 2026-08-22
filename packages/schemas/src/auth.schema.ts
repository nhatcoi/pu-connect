import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ' }),
  username: z
    .string()
    .min(3, { message: 'Username phải có ít nhất 3 ký tự' })
    .max(30, { message: 'Username tối đa 30 ký tự' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username chỉ chứa chữ cái, số và dấu gạch dưới' }),
  displayName: z.string().min(1, { message: 'Tên hiển thị không được để trống' }).max(50),
  password: z.string().min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' }),
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
  faculty: z.string().min(2, { message: 'Vui lòng chọn Khoa / Viện đào tạo' }),
  academicYear: z.string().min(2, { message: 'Vui lòng chọn Khóa học / Niên khóa' }),
  courses: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  bio: z.string().max(250).optional(),
  followUserIds: z.array(z.string()).default([])
})

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  studentId: z.string().optional().nullable(),
  faculty: z.string().optional().nullable(),
  academicYear: z.string().optional().nullable(), // e.g. "K16", "K17"
  major: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(250).optional().nullable(),
  role: z.enum(['student', 'lecturer', 'ta', 'club_lead', 'alumni', 'admin']).default('student'),
  reputationPoints: z.number().default(0),
  isOnboarded: z.boolean().default(false),
  skills: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  createdAt: z.string()
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type OnboardingInput = z.infer<typeof OnboardingSchema>
export type UserProfile = z.infer<typeof UserProfileSchema>
