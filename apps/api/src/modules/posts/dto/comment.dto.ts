import { z } from 'zod'

// PATCH /comments/:id — runtime schema đặt tại API (@pu/schemas chỉ import type)
export const UpdateCommentBodySchema = z
  .object({
    content: z.string().trim().min(1, { message: 'Nội dung bình luận không được để trống' }).max(10000)
  })
  .strict()

export type UpdateCommentBody = z.infer<typeof UpdateCommentBodySchema>

// POST /comments/:id/report
export const ReportCommentBodySchema = z
  .object({
    reason: z.string().trim().min(1, { message: 'Vui lòng chọn lý do báo cáo' }).max(50),
    details: z.string().trim().max(500).optional()
  })
  .strict()

export type ReportCommentBody = z.infer<typeof ReportCommentBodySchema>
