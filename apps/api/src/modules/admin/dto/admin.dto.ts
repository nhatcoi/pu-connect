import { z } from 'zod'
import type { AdminReasonInput } from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại schema runtime ở đây (xem auth/dto/register.dto.ts)
export const AdminReasonBodySchema = z.object({
  reason: z.string().trim().max(255).optional()
})

// Báo lỗi biên dịch nếu lệch với @pu/schemas
const _check: AdminReasonInput = {} as z.infer<typeof AdminReasonBodySchema>
void _check
