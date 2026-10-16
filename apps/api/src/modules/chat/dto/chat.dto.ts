import { z } from 'zod'
import type {
  AiSkillInput,
  AiThreadUpdateInput,
  CreateGroupChatInput,
  EditMessageInput,
  MemberSettingsInput,
  SendMessageInput,
  UpdateGroupInput
} from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại schema runtime ở đây (xem auth/dto/register.dto.ts)
const AI_MODES = ['ask', 'explain', 'quiz', 'flashcards', 'summarize', 'plan'] as const
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
export const CHAT_REF_TYPES = ['course', 'document', 'post', 'thread'] as const
export const AI_CONNECTORS = ['library', 'my_documents', 'my_groups', 'web', 'web_search', 'google_drive', 'google_calendar'] as const
export const CHAT_MAX_REFS = 5
export const AI_SKILL_LIMIT = 30

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
    aiMode: z.enum(AI_MODES).optional(),
    refs: z
      .array(z.object({ type: z.enum(CHAT_REF_TYPES), id: z.string().uuid() }))
      .max(CHAT_MAX_REFS, { message: `Tối đa ${CHAT_MAX_REFS} ngữ cảnh mỗi tin` })
      .optional(),
    skillId: z.string().uuid().optional(),
    research: z.boolean().optional(),
    connectors: z.array(z.enum(AI_CONNECTORS)).max(AI_CONNECTORS.length).optional()
  })
  .refine((v) => v.content.length > 0 || (v.attachments?.length ?? 0) > 0, { message: 'Tin nhắn trống', path: ['content'] })

// GET /chat/refs?q=&types=course,document
export const RefSuggestQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  types: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : [...CHAT_REF_TYPES]))
    .pipe(z.array(z.enum(CHAT_REF_TYPES)).min(1))
})
export type RefSuggestQuery = z.infer<typeof RefSuggestQuerySchema>

// GET /ai/threads?q=&cursor=&limit=
export const ListAiThreadsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})
export type ListAiThreadsQuery = z.infer<typeof ListAiThreadsQuerySchema>

export const AiLibraryQuerySchema = z.object({
  kind: z.enum(['image', 'file', 'study']),
  cursor: z.string().regex(/^\d+$/).optional(), // id tin cuối trang trước
  limit: z.coerce.number().int().min(1).max(60).default(30)
})
export type AiLibraryQuery = z.infer<typeof AiLibraryQuerySchema>

export const AiThreadUpdateBodySchema = z.object({ title: z.string().trim().min(1, { message: 'Nhập tên' }).max(150) })

export const AiSkillBodySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, { message: 'Lệnh 2–40 ký tự: chữ thường không dấu, số, dấu gạch ngang' }),
  name: z.string().trim().min(1, { message: 'Nhập tên skill' }).max(60),
  description: z.string().trim().max(200).default(''),
  instructions: z.string().trim().min(10, { message: 'Chỉ dẫn tối thiểu 10 ký tự' }).max(4000, { message: 'Chỉ dẫn tối đa 4000 ký tự' }),
  inputHint: z.string().trim().max(150).nullable().optional(),
  isPublic: z.boolean().default(false)
})

// GET /ai/skills/library?q=
export const SkillLibraryQuerySchema = z.object({ q: z.string().trim().max(100).default('') })

// GET /conversations?filter=&cursor=&limit=
export const ListConversationsQuerySchema = z.object({
  filter: z.enum(['all', 'unread', 'group']).default('all'),
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
})
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>

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
  // Key ảnh trong avatars/{userId}/ (tải lên trước); null = xóa ảnh nhóm
  avatarKey: z.string().max(300).nullable().optional()
})

export const AddMembersBodySchema = z.object({ userIds: z.array(z.string().uuid()).min(1, { message: 'Chọn người để thêm' }).max(49) })

export const TransferOwnerBodySchema = z.object({ userId: z.string().uuid() })

export const MemberSettingsBodySchema = z.object({
  mutedHours: z
    .number()
    .int()
    .min(-1)
    .max(24 * 30)
    .optional(),
  pinned: z.boolean().optional()
})

export const MarkReadBodySchema = z.object({ messageId: z.string().regex(/^\d+$/, { message: 'Tin nhắn không hợp lệ' }) })

// Báo lỗi biên dịch nếu lệch với @pu/schemas
const _send: SendMessageInput = {} as z.infer<typeof SendMessageBodySchema>
const _edit: EditMessageInput = {} as z.infer<typeof EditMessageBodySchema>
const _group: CreateGroupChatInput = {} as z.infer<typeof CreateGroupChatBodySchema>
const _update: UpdateGroupInput = {} as z.infer<typeof UpdateGroupBodySchema>
const _settings: MemberSettingsInput = {} as z.infer<typeof MemberSettingsBodySchema>
const _thread: AiThreadUpdateInput = {} as z.infer<typeof AiThreadUpdateBodySchema>
const _skill: AiSkillInput = {} as z.infer<typeof AiSkillBodySchema>
void [_send, _edit, _group, _update, _settings, _thread, _skill]
