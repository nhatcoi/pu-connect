import type { UnitKind, UserUnits } from '@pu/schemas'

// Bảng / cột theo loại đơn vị (giá trị cố định trong code ⇒ an toàn khi nối vào SQL)
export const UNIT_TABLE: Record<UnitKind, { table: 'universities' | 'interest_fields'; userColumn: 'university_id' | 'interest_field_id' }> = {
  university: { table: 'universities', userColumn: 'university_id' },
  field: { table: 'interest_fields', userColumn: 'interest_field_id' }
}

// Trường mặc định (email trường Phenikaa ⇒ tự chọn)
export const DEFAULT_UNIVERSITY_ID_SQL = `(SELECT id FROM universities WHERE code = 'phenikaa')`

// Tên lĩnh vực quan tâm của người dùng (subquery, nhúng vào SELECT)
export const fieldNameSql = (alias = 'u') => `(SELECT x.name FROM interest_fields x WHERE x.id = ${alias}.interest_field_id)`

// So khớp tên không phân biệt hoa thường / dấu (cùng biểu thức với unique index uq_universities_name…)
export const foldSql = (expr: string) => `lower(immutable_unaccent(btrim(${expr})))`

// Yêu cầu "Khác" hiện hành của người dùng (chờ duyệt hoặc bị từ chối; mỗi loại tối đa 1 dòng — xem UnitRequestsService.applyChoice)
const requestColumn = (alias: string, kind: UnitKind, col: 'name' | 'status') =>
  `(SELECT r.${col} FROM unit_requests r WHERE r.user_id = ${alias}.id AND r.kind = '${kind}' AND r.status <> 'approved' LIMIT 1)`

// Đơn vị của người dùng trong một câu SELECT (subquery, không cần JOIN ⇒ dùng được cả khi câu lệnh không đặt bí danh):
//   SELECT ..., ${USER_UNIT_COLUMNS('u')} FROM users u  — đọc kết quả bằng mapUserUnits(row)
export const USER_UNIT_COLUMNS = (alias = 'u') => `
  ${alias}.university_id, ${alias}.interest_field_id,
  (SELECT x.name FROM universities x WHERE x.id = ${alias}.university_id) AS university_name,
  (SELECT x.name FROM interest_fields x WHERE x.id = ${alias}.interest_field_id) AS interest_field_name,
  ${requestColumn(alias, 'university', 'name')} AS university_request,
  ${requestColumn(alias, 'university', 'status')} AS university_request_status,
  ${requestColumn(alias, 'field', 'name')} AS interest_field_request,
  ${requestColumn(alias, 'field', 'status')} AS interest_field_request_status`

const OTHER_LABEL = 'Khác'

// Chờ duyệt / bị từ chối ⇒ hiển thị "Khác"; tên đã gửi + trạng thái chỉ trả cho chủ hồ sơ (điền lại form)
export function mapUserUnits(row: Record<string, any>, isOwner = false): UserUnits {
  const units: UserUnits = {
    universityId: row.university_id ?? null,
    university: row.university_name ?? (row.university_request ? OTHER_LABEL : null),
    interestFieldId: row.interest_field_id ?? null,
    interestField: row.interest_field_name ?? (row.interest_field_request ? OTHER_LABEL : null)
  }
  if (isOwner) {
    units.universityRequest = row.university_request ?? null
    units.interestFieldRequest = row.interest_field_request ?? null
    units.universityRequestStatus = row.university_request_status ?? null
    units.interestFieldRequestStatus = row.interest_field_request_status ?? null
  }
  return units
}
