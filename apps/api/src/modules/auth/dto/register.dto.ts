import { z } from 'zod'
import type { RegisterInput } from '@pu/schemas'

// Schema validate phía server. @pu/schemas là mã TS nguồn nên API chỉ import "type" ở runtime,
// vì vậy khai báo lại ở đây; assertion bên dưới báo lỗi biên dịch nếu lệch với @pu/schemas.
export const RegisterBodySchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Email không hợp lệ' }),
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
})

type _InSync = z.infer<typeof RegisterBodySchema> extends RegisterInput ? (RegisterInput extends z.infer<typeof RegisterBodySchema> ? true : never) : never
export const _registerSchemaInSync: _InSync = true
