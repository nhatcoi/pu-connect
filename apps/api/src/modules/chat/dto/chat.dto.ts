import { z } from 'zod'
import type { CreateGroupChatInput, SendMessageInput } from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại schema runtime ở đây (xem auth/dto/register.dto.ts)
export const SendMessageBodySchema = z.object({
  clientMsgId: z.string().uuid().optional(), // chống gửi trùng khi retry + optimistic UI
  content: z.string().trim().min(1, { message: 'Tin nhắn trống' }).max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' }),
  replyToId: z.string().regex(/^\d+$/).optional()
})

export const OpenDirectBodySchema = z.object({ userId: z.string().uuid({ message: 'Người dùng không hợp lệ' }) })

export const CreateGroupChatBodySchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150),
  memberIds: z.array(z.string().uuid()).min(1, { message: 'Chọn ít nhất 1 thành viên' }).max(49)
})

export const MarkReadBodySchema = z.object({ messageId: z.string().regex(/^\d+$/, { message: 'Tin nhắn không hợp lệ' }) })

// Báo lỗi biên dịch nếu lệch với @pu/schemas
const _send: SendMessageInput = {} as z.infer<typeof SendMessageBodySchema>
const _group: CreateGroupChatInput = {} as z.infer<typeof CreateGroupChatBodySchema>
void _send
void _group
