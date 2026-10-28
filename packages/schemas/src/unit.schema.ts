// Đơn vị của người dùng: chỉ hai loại — trường đại học và lĩnh vực quan tâm (không khoa / ngành / khóa / lớp)
// Chọn "Khác" + nhập tên ⇒ yêu cầu chờ admin duyệt (unit_requests); trong lúc chờ người dùng hiển thị là "Khác"

export const UNIT_KINDS = ['university', 'field'] as const
export type UnitKind = (typeof UNIT_KINDS)[number]

// Nhãn hiển thị khi người dùng đã chọn "Khác" mà chưa được duyệt
export const UNIT_OTHER_LABEL = 'Khác'
export const DEFAULT_UNIVERSITY_NAME = 'Trường Đại học Phenikaa'

export interface UnitOption {
  id: string
  name: string
}

// Danh mục công khai (GET /api/units)
export interface UnitCatalog {
  universities: UnitOption[]
  fields: UnitOption[]
}

// Lựa chọn đơn vị gửi lên khi sửa hồ sơ / onboarding:
// *Id = chọn từ danh mục; *Other = "Khác" + tên tự nhập (chờ duyệt); cả hai trống = bỏ chọn
export interface UnitChoiceInput {
  universityId?: string | null
  universityOther?: string | null
  interestFieldId?: string | null
  interestFieldOther?: string | null
}

// Phần đơn vị trong hồ sơ người dùng
export interface UserUnits {
  universityId: string | null
  university: string | null // tên trường; "Khác" khi đang chờ duyệt / bị từ chối
  interestFieldId: string | null
  interestField: string | null // tên lĩnh vực; "Khác" khi đang chờ duyệt / bị từ chối
  // Tên đã gửi chờ duyệt (chỉ chủ hồ sơ thấy) để điền sẵn lại form
  universityRequest?: string | null
  interestFieldRequest?: string | null
  // pending = chờ duyệt · rejected = admin từ chối (hồ sơ vẫn là "Khác" cho tới khi người dùng chọn lại)
  universityRequestStatus?: 'pending' | 'rejected' | null
  interestFieldRequestStatus?: 'pending' | 'rejected' | null
}

// Admin: danh mục + số người dùng / môn học
export interface AdminUnit extends UnitOption {
  code: string
  sortOrder: number
  isActive: boolean
  userCount: number
  courseCount: number // chỉ lĩnh vực
}

export interface AdminUnitCatalog {
  universities: AdminUnit[]
  fields: AdminUnit[]
}

export type UnitRequestStatus = 'pending' | 'approved' | 'rejected'

export interface AdminUnitRequest {
  id: string
  kind: UnitKind
  name: string
  status: UnitRequestStatus
  user: { id: string; username: string; displayName: string; avatarUrl: string | null }
  // Số người khác đã gửi cùng tên (duyệt một lần áp dụng cho tất cả)
  sameNameCount: number
  // Đơn vị đã có trùng tên gần giống (gợi ý gộp)
  suggestion: UnitOption | null
  resolvedName: string | null
  rejectReason: string | null
  createdAt: string
  reviewedAt: string | null
}

// Duyệt: tạo đơn vị mới (name = tên sửa lại nếu cần) hoặc gộp vào đơn vị đã có (existingId)
export interface AdminUnitRequestApprove {
  name?: string
  existingId?: string
}

export interface AdminUnitInput {
  kind: UnitKind
  name: string
}

export interface AdminUnitPatch {
  name?: string
  isActive?: boolean
}
