import { z } from 'zod'
import type { CreateGroupChatInput, EditMessageInput, MemberSettingsInput, SendMessageInput, UpdateGroupInput } from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại schema runtime ở đây (xem auth/dto/register.dto.ts)
const AI_MODES = ['ask', 'explain', 'quiz', 'flashcards', 'summarize', 'plan'] as const
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

const AttachmentBodySchema = z.object({
  url: z.string().url(),
  key: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mime: z.string().min(1).max(150),
  kind: z.enum(['image', 'file'])
})

export const SendMessageBodySchema = z
  .object({
    clientMsgId: z.string().uuid().optional(), // chống gửi trùng khi retry + optimistic UI
    content: z.string().trim().max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' }).default(''),
    replyToId: z.string().regex(/^\d+$/).optional(),
    attachments: z.array(AttachmentBodySchema).max(10, { message: 'Tối đa 10 tệp mỗi tin' }).optional(),
    aiMode: z.enum(AI_MODES).optional()
  })
  .refine((v) => v.content.length > 0 || (v.attachments?.length ?? 0) > 0, { message: 'Tin nhắn trống', path: ['content'] })

export const EditMessageBodySchema = z.object({
  content: z.string().trim().min(1, { message: 'Tin nhắn trống' }).max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' })
})

export const ReactBodySchema = z.object({ emoji: z.enum(REACTIONS, { message: 'Cảm xúc không hợp lệ' }) })

export const OpenDirectBodySchema = z.object({ userId: z.string().uuid({ message: 'Người dùng không hợp lệ' }) })

export const CreateGroupChatBodySchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150),
  memberIds: z.array(z.string().uuid()).min(1, { message: 'Chọn ít nhất 1 thành viên' }).max(49)
})

export const UpdateGroupBodySchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional()
})

export const AddMembersBodySchema = z.object({ userIds: z.array(z.string().uuid()).min(1, { message: 'Chọn người để thêm' }).max(49) })

export const MemberSettingsBodySchema = z.object({
  mutedHours: z.number().int().min(-1).max(24 * 30).optional(),
  pinned: z.boolean().optional()
})

export const MarkReadBodySchema = z.object({ messageId: z.string().regex(/^\d+$/, { message: 'Tin nhắn không hợp lệ' }) })

// Báo lỗi biên dịch nếu lệch với @pu/schemas
const _send: SendMessageInput = {} as z.infer<typeof SendMessageBodySchema>
const _edit: EditMessageInput = {} as z.infer<typeof EditMessageBodySchema>
const _group: CreateGroupChatInput = {} as z.infer<typeof CreateGroupChatBodySchema>
const _update: UpdateGroupInput = {} as z.infer<typeof UpdateGroupBodySchema>
const _settings: MemberSettingsInput = {} as z.infer<typeof MemberSettingsBodySchema>
void [_send, _edit, _group, _update, _settings]
