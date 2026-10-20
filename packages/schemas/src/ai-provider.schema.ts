// Provider AI (OpenAI-compatible) do admin quản lý — kiểu dùng chung Admin / API (chỉ type)
// API key chỉ đi một chiều (admin → server): không bao giờ có trong kiểu trả về, chỉ có keyHint

export interface AdminAiProvider {
  id: string
  name: string
  baseUrl: string
  keyHint: string // 4 ký tự cuối của key
  modelOverride: string | null
  enabled: boolean
  priority: number // thứ tự thử, nhỏ trước; provider đầu tiên đang bật là chính
}

// Cấu hình đang chạy từ env của server (host thôi, không có key) — dùng khi chưa có provider nào trong DB
export interface AdminAiEnvProvider {
  name: string
  host: string
  modelOverride: string | null
}

export interface AdminAiProviderList {
  source: 'database' | 'env' // nguồn đang dùng thật
  items: AdminAiProvider[]
  env: AdminAiEnvProvider[]
}

export interface AdminAiProviderInput {
  name: string
  baseUrl: string
  apiKey: string
  modelOverride?: string | null
}

export interface AdminAiProviderPatch {
  name?: string
  baseUrl?: string
  apiKey?: string // bỏ trống = giữ key cũ
  modelOverride?: string | null
  enabled?: boolean
}

export interface AdminAiProviderTest {
  ok: boolean
  latencyMs: number
  models: number | null // số model gateway báo về
  error?: string
}
