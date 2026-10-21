// Danh mục model N7AI do admin quản lý — kiểu dùng chung Web / Admin / API (chỉ type)
// id = mã model trong N7AI (người dùng chọn); upstreamModel = tên model gửi lên provider

// Công khai: menu chọn model của người dùng
export interface AiModelOption {
  id: string
  label: string
  hint: string
  cost: number // số lượt quota mỗi câu hỏi
}

export type AiReasoningEffort = 'low' | 'medium' | 'high'

export interface AdminAiModel extends AiModelOption {
  visible: boolean
  enabled: boolean
  isDefault: boolean
  sortOrder: number
  providerId: string | null // null = chuỗi provider mặc định
  providerName: string | null
  upstreamModel: string | null // null = dùng id
  reasoningEffort: AiReasoningEffort | null
  maxInputTokens: number | null
  maxOutputTokens: number | null
  users: number // người đang chọn model này
  runs7d: number // lượt chạy 7 ngày qua
  errors7d: number
}

export interface AdminAiModelInput {
  id?: string // bỏ trống = tự tạo từ upstreamModel
  label: string
  hint?: string
  cost?: number
  visible?: boolean
  providerId?: string | null
  upstreamModel?: string | null
  reasoningEffort?: AiReasoningEffort | null
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
}

export interface AdminAiModelPatch {
  id?: string // Tên model map (mã nội bộ N7AI)
  label?: string
  hint?: string
  cost?: number
  visible?: boolean
  enabled?: boolean
  isDefault?: boolean
  providerId?: string | null
  upstreamModel?: string | null
  reasoningEffort?: AiReasoningEffort | null
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
}

// Model do provider báo về (GET {baseUrl}/models) + đã có trong danh mục chưa
export interface AdminAiDiscoveredModel {
  name: string
  imported: boolean
}

export interface AdminAiDiscovery {
  ok: boolean
  latencyMs: number
  error?: string
  models: AdminAiDiscoveredModel[]
}
