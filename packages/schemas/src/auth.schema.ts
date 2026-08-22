import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ' }),
  username: z
    .string()
    .min(3, { message: 'Username phải có ít nhất 3 ký tự' })
    .max(30, { message: 'Username tối đa 30 ký tự' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username chỉ chứa chữ cái, số và dấu gạch dưới' }),
  displayName: z.string().min(1, { message: 'Tên hiển thị không được để trống' }).max(50),
  password: z.string().min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
})

export const LoginSchema = z.object({
  emailOrUsername: z.string().min(1, { message: 'Vui lòng nhập Email hoặc Username' }),
  password: z.string().min(1, { message: 'Vui lòng nhập mật khẩu' })
})

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(250).optional().nullable(),
  createdAt: z.string()
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type UserProfile = z.infer<typeof UserProfileSchema>
