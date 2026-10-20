// Danh mục model N7AI do admin quản lý — kiểu dùng chung Web / Admin / API (chỉ type)
// id = tên model trên gateway; API key luôn nằm ở env của server, không đi qua các kiểu này

// Công khai: menu chọn model của người dùng
export interface AiModelOption {
  id: string
  label: string
  hint: string
  cost: number // số lượt quota mỗi câu hỏi
}

export interface AdminAiModel extends AiModelOption {
  visible: boolean
  enabled: boolean
  isDefault: boolean
  sortOrder: number
  users: number // người đang chọn model này
  runs7d: number // lượt chạy 7 ngày qua
  errors7d: number
}

export interface AdminAiModelInput {
  id: string
  label: string
  hint?: string
  cost?: number
  visible?: boolean
}

export interface AdminAiModelPatch {
  label?: string
  hint?: string
  cost?: number
  visible?: boolean
  enabled?: boolean
  isDefault?: boolean
}
