// Cây đơn vị học thuật (trường → khoa → ngành, viện, trung tâm) — kiểu dùng chung Web / Admin / API (chỉ type)

export const ACADEMIC_UNIT_TYPES = ['school', 'faculty', 'major', 'institute', 'center'] as const
export type AcademicUnitKind = (typeof ACADEMIC_UNIT_TYPES)[number]

// Danh sách phẳng công khai (client tự dựng cây / tìm kiếm)
export interface AcademicUnit {
  id: string
  parentId: string | null
  type: AcademicUnitKind
  name: string
  shortName: string | null
}

// Admin: thêm số người dùng (trực tiếp / gồm đơn vị con) và trạng thái
export interface AdminAcademicUnit extends AcademicUnit {
  code: string
  sortOrder: number
  isActive: boolean
  childCount: number
  userCount: number // người dùng gắn trực tiếp vào đơn vị này
  userTotal: number // gồm toàn bộ đơn vị con
}

export interface AdminAcademicUnitInput {
  type: AcademicUnitKind
  name: string
  shortName?: string | null
  parentId?: string | null
}

export interface AdminAcademicUnitPatch {
  type?: AcademicUnitKind
  name?: string
  shortName?: string | null
  parentId?: string | null
  isActive?: boolean
}
