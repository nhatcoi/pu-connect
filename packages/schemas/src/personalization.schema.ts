import type { AiMode } from './chat.schema'

// Cá nhân hóa: sự kiện hành vi (client gửi theo lô) & gợi ý PU AI (docs/core/06-messaging-and-ai.md §19)

export const USER_EVENT_TYPES = [
  'post_view', // bài hiện trong màn hình ≥ 2s (bảng tin)
  'post_open', // mở trang chi tiết bài
  'doc_open', // mở trang chi tiết tài liệu
  'doc_download',
  'search', // meta: { q, type }
  'search_click', // bấm kết quả tìm kiếm (target = bài / tài liệu)
  'ai_suggestion_click' // meta: { source, kind?, key? }
] as const
export type UserEventType = (typeof USER_EVENT_TYPES)[number]

export interface UserEventInput {
  type: UserEventType
  targetType?: 'post' | 'document'
  targetId?: string
  meta?: Record<string, string>
}

export const USER_EVENTS_MAX_BATCH = 50

// Chủ đề quan tâm suy ra từ hành vi
export type InterestKind = 'course' | 'tag' | 'query'

export interface AiSuggestion {
  mode: AiMode
  text: string
  topic: { kind: InterestKind; key: string } | null // null = gợi ý mặc định
}

export interface AiSuggestionsResponse {
  personalized: boolean
  items: AiSuggestion[]
}
