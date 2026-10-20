// Bộ lọc khoa theo mã cũ (FIT, FCS…): người dùng giờ lưu tên viết tắt (CNTT, KHMT…) nên so theo nhánh đơn vị trong cây
// Legacy faculty codes → academic_units.code; users filter by unit subtree (or exact short name)
const LEGACY_FACULTY_UNIT: Record<string, string> = {
  FIT: 'school-it',
  FCS: 'fac-cs',
  FEE: 'fac-ee',
  FAE: 'fac-automotive',
  FBA: 'fac-ba',
  FEL: 'school-languages',
  FMS: 'school-health',
  FAS: 'fac-materials'
}

// Điều kiện "người dùng thuộc khoa này" (gồm đơn vị con); thêm 2 tham số vào params
export function userFacultySql(params: unknown[], faculty: string, alias = 'u'): string {
  params.push(faculty)
  const f = `$${params.length}`
  params.push(LEGACY_FACULTY_UNIT[faculty.toUpperCase()] ?? '')
  const code = `$${params.length}`
  return `(${alias}.faculty = ${f} OR ${alias}.unit_id IN (
    WITH RECURSIVE sub(id) AS (
      SELECT id FROM academic_units WHERE code = ${code} OR short_name = ${f} OR name = ${f}
      UNION ALL SELECT c.id FROM academic_units c JOIN sub s ON c.parent_id = s.id
    ) SELECT id FROM sub))`
}
