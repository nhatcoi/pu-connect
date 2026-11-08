import { apiClient } from './api-client'

export interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export const API_KEY_SCOPE_OPTIONS = [
  { id: 'read', label: 'Đọc', hint: 'Tìm kiếm, bảng tin, bài viết, tài liệu, thông báo' },
  { id: 'write', label: 'Đăng & tương tác', hint: 'Đăng bài, bình luận, thích, theo dõi học phần, tham gia cộng đồng' },
  { id: 'documents', label: 'Tài liệu', hint: 'Tải lên, sửa, chấm sao, xóa tài liệu của bạn' },
  { id: 'ai', label: 'N7AI & ghi chú', hint: 'Tóm tắt, hỏi cộng đồng, đọc/ghi ghi chú (tính hạn mức AI)' }
] as const

type Envelope<T> = { success: boolean; data: T }

export const listApiKeys = async () => (await apiClient<Envelope<ApiKeyItem[]>>('/api-keys')).data
export const createApiKey = async (input: { name: string; scopes: string[]; expiresInDays?: number | null }) =>
  (await apiClient<Envelope<ApiKeyItem & { key: string }>>('/api-keys', { method: 'POST', body: JSON.stringify(input) })).data
export const revokeApiKey = (id: string) => apiClient<Envelope<{ success: boolean }>>(`/api-keys/${id}`, { method: 'DELETE' })
