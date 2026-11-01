import { z } from 'zod'
import type { ChatStudySetRef } from './study-tools.schema'
import type { BlockState } from './block.schema'

// Nhắn tin: DM, nhóm, hội thoại với N7AI (docs/core/06-messaging-and-ai.md)

export const CHAT_MAX_ATTACHMENTS = 10
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

// Chế độ học của N7AI (DeepTutor Capabilities): đổi chỉ dẫn hệ thống + cách xử lý lượt trò chuyện
export const AI_MODES = [
  'ask',
  'explain',
  'quiz',
  'flashcards',
  'summarize',
  'plan',
  'solve',
  'deep_solve',
  'ask_questions',
  'deep_question',
  'deep_research',
  'research',
  'visualize',
  'video_lesson',
  'audio_overview',
  'math_animator'
] as const
export type AiMode = (typeof AI_MODES)[number]

// Ngữ cảnh gắn vào tin (chip trên ô soạn): server kiểm quyền rồi mới lưu meta.refs
export const CHAT_MAX_REFS = 5

// Đoạn bôi đen trong tài liệu / phụ đề video gắn vào câu hỏi N7AI (chip trên ô soạn); chỉ thread N7AI riêng
export const CHAT_MAX_QUOTES = 3
export const CHAT_QUOTE_MAX_CHARS = 2000
export const ChatQuoteSchema = z.object({
  title: z.string().trim().min(1).max(200), // tên tài liệu
  text: z.string().trim().min(1).max(CHAT_QUOTE_MAX_CHARS),
  locator: z.string().trim().max(40).optional(), // vị trí trong tài liệu: "12:30" (video) · "trang 5" (PDF)
  sourceId: z.string().uuid().optional() // tài liệu đã thêm (ai_sources) ⇒ bấm thẻ để mở lại; server bỏ nếu không phải của mình
})
export type ChatQuote = z.infer<typeof ChatQuoteSchema>
// thread / study_set: dữ liệu riêng của người hỏi ⇒ chỉ gắn khi hỏi N7AI trong thread riêng
export const CHAT_REF_TYPES = ['course', 'document', 'post', 'thread', 'study_set'] as const
export type ChatRefType = (typeof CHAT_REF_TYPES)[number]
export const PRIVATE_REF_TYPES: readonly ChatRefType[] = ['thread', 'study_set']

// Nguồn N7AI được đọc (connector); 'library' = mặc định; google_* cần kết nối OAuth
// my_study = bộ Flashcard / Quiz + tiến độ ôn (tool) · my_chats = các hội thoại N7AI cũ của mình (tool)
export const AI_CONNECTORS = [
  'library',
  'my_documents',
  'my_groups',
  'my_study',
  'my_chats',
  'web',
  'web_search',
  'google_drive',
  'google_calendar',
  'google_gmail',
  'google_forms',
  'google_sheets',
  'google_tasks',
  'pu_connector',
  'semantic_scholar'
] as const
export type AiConnectorId = (typeof AI_CONNECTORS)[number]

export const ChatAttachmentSchema = z.object({
  url: z.string().url(),
  key: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mime: z.string().min(1).max(150),
  kind: z.enum(['image', 'file'])
})
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>

export const SendMessageSchema = z
  .object({
    clientMsgId: z.string().uuid().optional(), // chống gửi trùng khi retry + optimistic UI
    content: z.string().trim().max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' }).default(''),
    replyToId: z.string().regex(/^\d+$/).optional(),
    attachments: z.array(ChatAttachmentSchema).max(CHAT_MAX_ATTACHMENTS).optional(),
    aiMode: z.enum(AI_MODES).optional(),
    refs: z
      .array(z.object({ type: z.enum(CHAT_REF_TYPES), id: z.string().uuid() }))
      .max(CHAT_MAX_REFS)
      .optional(),
    quotes: z.array(ChatQuoteSchema).max(CHAT_MAX_QUOTES).optional(),
    skillId: z.string().uuid().optional(),
    research: z.boolean().optional(),
    connectors: z.array(z.enum(AI_CONNECTORS)).max(AI_CONNECTORS.length).optional()
  })
  .refine((v) => v.content.length > 0 || (v.attachments?.length ?? 0) > 0, { message: 'Tin nhắn trống', path: ['content'] })
export type SendMessageInput = z.infer<typeof SendMessageSchema>

export const EditMessageSchema = z.object({
  content: z.string().trim().min(1, { message: 'Tin nhắn trống' }).max(4000, { message: 'Tin nhắn tối đa 4000 ký tự' })
})
export type EditMessageInput = z.infer<typeof EditMessageSchema>

export const ReactSchema = z.object({ emoji: z.enum(CHAT_REACTIONS) })

export const OpenDirectSchema = z.object({ userId: z.string().uuid() })

export const CreateGroupChatSchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150),
  memberIds: z.array(z.string().uuid()).min(1, { message: 'Chọn ít nhất 1 thành viên' }).max(49)
})
export type CreateGroupChatInput = z.infer<typeof CreateGroupChatSchema>

export const UpdateGroupSchema = z.object({
  title: z.string().trim().min(1, { message: 'Nhập tên nhóm' }).max(150).optional(),
  // Key ảnh trong avatars/{userId}/ (tải lên trước); null = xóa ảnh nhóm
  avatarKey: z.string().max(300).nullable().optional()
})
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>

export const AddMembersSchema = z.object({ userIds: z.array(z.string().uuid()).min(1).max(49) })

// muted: số giờ tắt thông báo (0 = bật lại, -1 = đến khi bật lại)
export const MemberSettingsSchema = z.object({
  mutedHours: z
    .number()
    .int()
    .min(-1)
    .max(24 * 30)
    .optional(),
  pinned: z.boolean().optional()
})
export type MemberSettingsInput = z.infer<typeof MemberSettingsSchema>

export const MarkReadSchema = z.object({ messageId: z.string().regex(/^\d+$/) })

export interface ChatUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isBot: boolean
}

export interface ChatMember extends ChatUser {
  role: 'owner' | 'member'
  lastReadMessageId: string
  joinedAt: string
}

// Nguồn N7AI thực sự dùng: bài / tài liệu PU, tệp Drive (id tệp), lịch Google, trang web (id = URL), bài báo khoa học (id = URL)
export interface ChatCitation {
  type: 'citation'
  ref: { type: 'post' | 'document' | 'drive' | 'calendar' | 'web' | 'paper'; id: string }
  title: string
}

export interface ChatReaction {
  emoji: string
  userIds: string[]
}

// Danh sách người đã thả cảm xúc (hộp thoại "Cảm xúc về tin nhắn")
export interface ChatReactionDetail {
  emoji: string
  user: ChatUser
  createdAt: string
}

export interface ChatReplyPreview {
  id: string
  senderName: string | null
  content: string
  hasAttachments: boolean
  deleted: boolean
}

// Tin hệ thống (thêm/xóa thành viên, đổi tên nhóm, làm mới ngữ cảnh AI)
export type ChatSystemEvent =
  'group.created' | 'group.renamed' | 'member.added' | 'member.removed' | 'member.left' | 'group.avatar' | 'owner.transferred' | 'ai.reset'

// Người được nhắc trong tin (client tô sáng @username khớp danh sách này)
export interface ChatMentionedUser {
  id: string
  username: string
}

export interface ChatRef {
  type: ChatRefType
  id: string
  title: string
  code?: string // học phần: mã môn (dựng link /courses/[code]) · bộ học tập: loại bộ (flashcards / quiz ⇒ /tools/[kind]/[id])
}

export interface ChatSkillRef {
  id: string
  slug: string
  name: string
}

export interface ChatMessageMeta {
  aiMode?: AiMode
  mentions?: ChatMentionedUser[]
  mentionAll?: boolean
  refs?: ChatRef[]
  quotes?: ChatQuote[] // đoạn trích người dùng chọn từ tài liệu để hỏi (thẻ trích dẫn trên bong bóng)
  skill?: ChatSkillRef
  research?: boolean
  connectors?: AiConnectorId[]
  memoryUpdated?: string[] // N7AI vừa ghi nhớ (nhãn "Đã cập nhật bộ nhớ")
  feedback?: 1 | -1 // đánh giá của chủ thread AI
  task?: { id: string; title: string } // tin do tác vụ tự động gửi
  event?: ChatSystemEvent
  actorName?: string
  targetNames?: string[]
  followUps?: string[] // N7AI: câu hỏi gợi ý tiếp theo (chip dưới câu trả lời)
  steps?: AiStep[] // N7AI: tiến trình (đọc tệp / bộ nhớ, tìm nguồn, gọi tool) — hiện khi đang trả lời, thu gọn khi xong
  durationMs?: number // N7AI: thời gian xử lý (nhận câu hỏi → xong)
  timings?: AiRunTimings // Stage durations; tool/model intervals can overlap with MCP initialization
  reasoning?: string // N7AI: Luồng suy luận logic (Thinking Accordion)
  askUser?: { questions: AskUserQuestion[] } | null // N7AI: Câu hỏi / lựa chọn phản biện Socratic khi pause
  studySet?: ChatStudySetRef // bộ flashcard / quiz trong tin đã tự lưu vào Công cụ
  actions?: AiAction[] // N7AI: nút dẫn tới trang trong app / hành động cần người dùng xác nhận
  sharedPost?: ChatSharedPost // tin chia sẻ bài viết (thẻ xem trước)
  embeds?: ChatEmbed[] // thẻ xem trước link trong tin (nội bộ: server kiểm quyền; ngoài: Open Graph)
}

// Thẻ xem trước link: nội bộ (path trong app) hoặc link ngoài (URL tuyệt đối, đã qua chặn SSRF)
// Link preview card stored in message meta; internal kinds are permission-checked at send time
export interface ChatEmbed {
  kind: 'post' | 'profile' | 'community' | 'course' | 'page' | 'link'
  url: string
  title: string
  description: string
  image: string | null
  siteName: string | null // link ngoài: tên miền / og:site_name; nội bộ: nhãn loại ("Bài viết")
}

// Bài viết chia sẻ vào chat: ảnh chụp lúc gửi ⇒ thẻ xem trước không cần tải thêm
// Shared post snapshot stored in message meta
export interface ChatSharedPost {
  id: string
  title: string
  excerpt: string
  image: string | null
  author: { username: string; displayName: string; avatarUrl: string | null }
}

// POST /chat/share: gửi bài viết tới nhiều hội thoại / người (DM tự mở)
export const CHAT_SHARE_MAX_TARGETS = 10
export interface SharePostInput {
  postId: string
  conversationIds: string[]
  userIds: string[]
  note?: string
}
export interface SharePostResult {
  sent: number
  failed: number
  conversationIds: string[]
}

// Nút dưới câu trả lời N7AI (server kiểm trước khi lưu): link = mở trang trong app; join_group = tham gia nhóm học khi người dùng bấm xác nhận
export type AiAction = { kind: 'link'; label: string; href: string } | { kind: 'join_group'; id: string; label: string; href: string }

export interface ChatMessage {
  id: string // BIGSERIAL dạng chuỗi
  conversationId: string
  sender: ChatUser | null
  clientMsgId: string | null
  kind: 'text' | 'system' | 'ai'
  content: string
  blocks: ChatCitation[] | null
  attachments: ChatAttachment[] | null
  replyToId: string | null
  replyTo: ChatReplyPreview | null
  reactions: ChatReaction[]
  meta: ChatMessageMeta | null
  status: 'streaming' | 'done' | 'error'
  deleted: boolean
  editedAt: string | null
  pinnedAt: string | null
  createdAt: string
}

export interface ConversationSummary {
  id: string
  type: 'direct' | 'group' | 'ai'
  title: string | null
  avatarUrl: string | null
  studyGroupId: string | null // nhóm chat gắn với nhóm học
  members: ChatUser[] // thành viên khác (không gồm mình)
  memberCount: number
  myRole: 'owner' | 'member'
  lastMessage: ChatMessage | null
  lastMessageAt: string | null
  unreadCount: number
  unreadMentions: number // tin nhắc mình (hoặc @all) chưa đọc ⇒ badge "@"
  lastReadMessageId: string
  // Con trỏ đã đọc của người khác (hiện "Đã xem")
  readCursors: Record<string, string>
  mutedUntil: string | null
  pinnedAt: string | null
  // DM: quan hệ chặn với người kia (khác 'none' ⇒ không gửi tin được)
  blockState: BlockState
}

// Danh sách hội thoại: lọc ở server + phân trang keyset (cursor mờ)
export const CONVERSATION_FILTERS = ['all', 'unread', 'group'] as const
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number]
export interface ConversationsPage {
  data: ConversationSummary[]
  nextCursor: string | null
}

export interface MessagesPage {
  data: ChatMessage[] // mới nhất trước
  nextCursor: string | null
}

// ── N7AI: nhiều hội thoại (thread), skill, connector, gợi ý ngữ cảnh ─────────

export interface AiThread {
  id: string
  title: string | null
  folderId: string | null
  lastMessageAt: string | null
  createdAt: string
}

// Thư mục gom thread N7AI (docs/core/23-n7ai-folders.md)
export interface AiFolder {
  id: string
  name: string
  threadCount: number
}
export const AiFolderSchema = z.object({ name: z.string().trim().min(1, { message: 'Nhập tên thư mục' }).max(60) })
export type AiFolderInput = z.infer<typeof AiFolderSchema>
// Tài liệu của cuộc trò chuyện / thư viện N7AI: tệp, văn bản dán, liên kết web, YouTube (docs/core/24-n7ai-sources.md)
export const AI_SOURCE_LIMIT = 30 // / cuộc trò chuyện
export const AI_LIBRARY_SOURCE_LIMIT = 100 // / thư viện
export const AI_SOURCE_TEXT_MAX = 100_000
export type AiSourceKind = 'file' | 'text' | 'url' | 'youtube'
// YouTube: video + phụ đề đã lấy
export interface AiSourceMeta {
  videoId?: string
  lang?: string // ngôn ngữ phụ đề, vd 'vi'
  auto?: boolean // phụ đề tự động (không phải do người làm video)
  author?: string
  seconds?: number // độ dài video
  documentId?: string // tệp lấy từ kho tài liệu / bộ sưu tập
}
export interface AiSource {
  id: string
  threadId: string | null // null ⇒ thư viện
  kind: AiSourceKind
  title: string
  url: string | null // liên kết gốc (url, youtube)
  attachment: ChatAttachment | null // kind = file
  chars: number | null // độ dài văn bản đã đọc (text, url, youtube)
  meta: AiSourceMeta | null
  inContext: boolean // false ⇒ vẫn lưu trong cuộc trò chuyện nhưng N7AI không đọc ở các lượt trả lời
  createdAt: string
}
const sourceThread = z.string().uuid().optional() // bỏ trống ⇒ thư viện
export const AiSourceInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file'),
    threadId: sourceThread,
    file: z.object({ key: z.string().min(1).max(300), name: z.string().trim().min(1).max(200), size: z.number().int().positive(), mime: z.string().max(120) })
  }),
  z.object({
    type: z.literal('text'),
    threadId: sourceThread,
    title: z.string().trim().max(120).optional(),
    content: z.string().trim().min(1, { message: 'Dán nội dung cần học' }).max(AI_SOURCE_TEXT_MAX, { message: 'Văn bản quá dài (tối đa 100.000 ký tự)' })
  }),
  z.object({ type: z.literal('link'), threadId: sourceThread, url: z.string().trim().url({ message: 'Nhập liên kết hợp lệ' }).max(2000) }),
  z.object({ type: z.literal('copy'), threadId: z.string().uuid(), sourceId: z.string().uuid() }), // thêm tài liệu thư viện vào cuộc trò chuyện
  z.object({ type: z.literal('document'), threadId: sourceThread, documentId: z.string().uuid() }) // tài liệu trong kho (công khai hoặc của mình)
])
export type AiSourceInput = z.infer<typeof AiSourceInputSchema>
// Thêm cả bộ sưu tập: mỗi tài liệu đọc được thành một nguồn
export const AiSourceCollectionSchema = z.object({ threadId: sourceThread, collectionId: z.string().uuid() })
export type AiSourceCollectionInput = z.infer<typeof AiSourceCollectionSchema>
export interface AiSourceCollectionResult {
  added: number
  skipped: number // trùng, định dạng chưa đọc được, hoặc vượt giới hạn
}
export const AiSourcePatchSchema = z.object({ inContext: z.boolean() })
export type AiSourcePatch = z.infer<typeof AiSourcePatchSchema>
// Lọc danh sách thread: 'all' (tìm kiếm) · 'root' (chưa vào thư mục) · id thư mục
export type AiThreadFolderFilter = 'all' | 'root' | (string & {})
export interface AiThreadsPage {
  data: AiThread[]
  nextCursor: string | null
}

// Thư viện N7AI (/n7ai/library): ảnh, tệp đã gửi & học liệu (quiz / flashcard) trong mọi thread của mình
export type AiLibraryKind = 'image' | 'file' | 'study'
export interface AiLibraryItem {
  messageId: string
  threadId: string
  threadTitle: string | null
  createdAt: string
  attachments: ChatAttachment[] // image / file: chỉ tệp đúng loại
  content: string | null // study: câu trả lời chứa khối ```quiz / ```flashcards
}
export interface AiLibraryPage {
  data: AiLibraryItem[]
  nextCursor: string | null
}

export const AiThreadUpdateSchema = z.object({ title: z.string().trim().min(1, { message: 'Nhập tên' }).max(150) })
export type AiThreadUpdateInput = z.infer<typeof AiThreadUpdateSchema>
export const AiThreadMoveSchema = z.object({ folderId: z.string().uuid().nullable() })
export type AiThreadMoveInput = z.infer<typeof AiThreadMoveSchema>

export const AI_SKILL_LIMIT = 30
export const AiSkillStateSchema = z.object({ enabled: z.boolean().optional(), pinned: z.boolean().optional() })
export type AiSkillStateInput = z.infer<typeof AiSkillStateSchema>

export const AiSkillInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, { message: 'Lệnh 2–40 ký tự: chữ thường không dấu, số, dấu gạch ngang' }),
  name: z.string().trim().min(1, { message: 'Nhập tên skill' }).max(60),
  description: z.string().trim().max(200).default(''),
  instructions: z.string().trim().min(10, { message: 'Chỉ dẫn tối thiểu 10 ký tự' }).max(4000, { message: 'Chỉ dẫn tối đa 4000 ký tự' }),
  inputHint: z.string().trim().max(150).nullable().optional(),
  isPublic: z.boolean().default(false) // chia sẻ lên thư viện skill
})
export type AiSkillInput = z.infer<typeof AiSkillInputSchema>

// Tạo nhanh: mô tả bằng lời ⇒ N7AI viết bản nháp (chưa lưu), người dùng xem lại rồi mới tạo
export const AiSkillDraftInputSchema = z.object({
  prompt: z.string().trim().min(10, { message: 'Mô tả tối thiểu 10 ký tự' }).max(1000, { message: 'Mô tả tối đa 1000 ký tự' })
})
export type AiSkillDraftInput = z.infer<typeof AiSkillDraftInputSchema>
export type AiSkillDraft = Omit<AiSkillInput, 'isPublic'> & { inputHint: string | null }

// Danh sách nhẹ (không có instructions) — dùng cho menu "/"
export interface AiSkill {
  id: string
  slug: string
  name: string
  description: string
  inputHint: string | null
  useCount: number
  isPublic: boolean
  installCount: number
  enabled: boolean // tắt ⇒ ẩn khỏi menu "/"
  pinned: boolean // ghim lên đầu menu "/"
}
export interface AiSkillDetail extends AiSkill {
  instructions: string
}

// Thư viện skill công khai của người khác (cài = sao chép về skill của mình)
export interface AiPublicSkill {
  id: string
  slug: string
  name: string
  description: string
  installCount: number
  author: { username: string; displayName: string }
  official: boolean // skill dựng sẵn của N7AI
  installed: boolean
}

export interface AiConnectorInfo {
  id: AiConnectorId
  name: string
  description: string
  available: boolean // false = server chưa cấu hình
  requiresAuth: boolean // cần kết nối tài khoản ngoài
  connected: boolean
  account: string | null // email hoặc nhãn tài khoản trường đã kết nối
  lastUsedAt: string | null
  lastError: string | null
}

export interface ChatRefSuggestion {
  type: ChatRefType
  id: string
  title: string
  subtitle: string | null
  code?: string
}

export interface AiQuota {
  used: number
  limit: number
  enabled: boolean
}

// Sự kiện realtime (Socket.IO, room user:{id})
// Bước N7AI đang làm (tool call: Google MCP / Học tập của tôi): provider = connector, label tiếng Việt, detail = từ khóa / phạm vi ngắn (không có dữ liệu trả về)
// Nguồn tool của bước: connector hoặc 'puc' (tool về chính PU Connect: tìm kiếm, hướng dẫn app — luôn có trong thread riêng)
export type AiToolProvider = AiConnectorId | 'puc'
// Nguồn của 1 bước tiến trình: tool / connector truy xuất (library, web…) hoặc bước nội bộ — đọc mục gắn @, tệp đính kèm, bộ nhớ
export type AiStepSource = AiToolProvider | 'refs' | 'files' | 'memory'
export interface AiRunTimings {
  preparationMs?: number
  modelWaitMs: number
  modelStreamMs: number
  toolWallMs: number
  mcpOpenMs: number
  rounds: number
  toolCalls: number
  cacheHits: number
}

export interface AiStep {
  id: string
  provider: AiStepSource
  label: string
  detail?: string
  status: 'running' | 'done' | 'error'
  durationMs?: number
  resultCount?: number // số kết quả công cụ trả về (tìm kiếm); 0 ⇒ "không có kết quả"
}
// message.progress: danh sách bước đầy đủ (thay thế, không cộng dồn) của tin đang stream
export interface MessageProgressEvent {
  conversationId: string
  messageId: string
  steps: AiStep[]
}
export interface MessageDeltaEvent {
  conversationId: string
  messageId: string
  delta: string
}
export interface TypingEvent {
  conversationId: string
  userId: string
  isTyping: boolean
}
export interface ReadEvent {
  conversationId: string
  userId: string
  lastReadMessageId: string
}

// Trạng thái hoạt động của người cùng hội thoại (GET /presence, event presence.update)
export interface PresenceInfo {
  online: boolean
  lastSeenAt: string | null
}
export type PresenceMap = Record<string, PresenceInfo>
export interface PresenceUpdateEvent extends PresenceInfo {
  userId: string
}

// Chat tạm N7AI: không lưu hội thoại / bộ nhớ; lịch sử nằm ở client, mỗi lượt gửi lại toàn bộ (tối đa AI_TEMPORARY_MAX_TURNS tin)
export const AI_TEMPORARY_MAX_TURNS = 30
export interface AiTemporaryTurn {
  role: 'user' | 'assistant'
  content: string
}
export interface AiTemporaryInput {
  messages: AiTemporaryTurn[]
  aiMode?: AiMode
  research?: boolean
  connectors?: AiConnectorId[]
}
export interface AskUserOption {
  label: string
  description?: string | null
}

export interface AskUserQuestion {
  id: string
  prompt: string
  header?: string | null
  options: AskUserOption[]
  multi_select?: boolean
  allow_free_text?: boolean
  placeholder?: string | null
}

// Sự kiện SSE của POST /ai/temporary/stream
export type AiTemporaryEvent =
  | { type: 'thinking'; text: string }
  | { type: 'progress'; steps: AiStep[] }
  | { type: 'delta'; text: string }
  | { type: 'ask_user'; questions: AskUserQuestion[] }
  | {
      type: 'done'
      text: string
      reasoning?: string
      followUps: string[]
      citations: ChatCitation[]
      steps: AiStep[]
      durationMs: number
      askUser?: { questions: AskUserQuestion[] } | null
    }
  | { type: 'error'; message: string }
