import { z } from 'zod'

// POST /users/:id/report — runtime schema đặt tại API (@pu/schemas chỉ import type)
export const ReportUserBodySchema = z
  .object({
    reason: z.string().trim().min(1, { message: 'Vui lòng chọn lý do báo cáo' }).max(50),
    details: z.string().trim().max(500).optional()
  })
  .strict()

export type ReportUserBody = z.infer<typeof ReportUserBodySchema>
