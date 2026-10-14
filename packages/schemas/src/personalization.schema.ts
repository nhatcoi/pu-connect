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

// Admin: ảnh chụp dữ liệu cá nhân hóa của 1 người (chỉ đọc) / Per-user personalisation snapshot
export interface UserInsightEvent {
  type: UserEventType
  createdAt: string
  target: string | null // tên bài / tài liệu, hoặc từ khóa tìm kiếm
  course: string | null
  tags: string[]
}

export interface UserInsight {
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    major: string | null
    className: string | null
    interests: string[]
    skills: string[]
    lastSeenAt: string | null
  }
  personalization: boolean
  profileUpdatedAt: string | null
  profileStale: boolean
  interests: { kind: InterestKind; key: string; label: string; score: number }[]
  signals: {
    postsAuthored: number
    docsUploaded: number
    postsSaved: number
    studyGroups: number
    comments: number
    reactions: number
    aiQuestions: number
  }
  eventCounts: Partial<Record<UserEventType, number>>
  recentEvents: UserInsightEvent[]
  aiQuestions: { createdAt: string; text: string; courses: string[] }[]
  suggestionPreview: AiSuggestion[] // gợi ý chế độ "Hỏi đáp" từ hồ sơ đang lưu
}
