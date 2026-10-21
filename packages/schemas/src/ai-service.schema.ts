export type AiServiceType = 'embedding' | 'ocr'

export interface AdminAiServiceItem {
  service: AiServiceType
  name: string
  enabled: boolean
  baseUrl: string
  keyHint: string
  model: string
  maxPages?: number
  updatedAt: string
}

export interface AdminAiServicesOverview {
  embedding: AdminAiServiceItem
  ocr: AdminAiServiceItem
}

export interface AdminAiServicePatch {
  enabled?: boolean
  baseUrl?: string
  apiKey?: string // bỏ trống = giữ nguyên
  model?: string
  maxPages?: number
}

export interface AdminAiServiceTestResult {
  ok: boolean
  latencyMs: number
  error?: string
}
