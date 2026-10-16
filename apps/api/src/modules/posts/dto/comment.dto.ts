import { z } from 'zod'

// PATCH /comments/:id — runtime schema đặt tại API (@pu/schemas chỉ import type)
export const UpdateCommentBodySchema = z
  .object({
    content: z.string().trim().min(1, { message: 'Nội dung bình luận không được để trống' }).max(10000)
  })
  .strict()

export type UpdateCommentBody = z.infer<typeof UpdateCommentBodySchema>
