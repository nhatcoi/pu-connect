import type { AcademicUnit } from '@pu/schemas'

// Bỏ dấu + thường hóa để tìm "khoa hoc may tinh" ra "Khoa học máy tính"
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()

export interface UnitChain {
  school: AcademicUnit | null
  faculty: AcademicUnit | null // khoa / viện / trung tâm
  major: AcademicUnit | null
}

// Đi ngược cây từ một đơn vị: trường / khoa / ngành chứa nó
export function unitChain(units: AcademicUnit[], unit: AcademicUnit): UnitChain {
  const byId = new Map(units.map((u) => [u.id, u]))
  const chain: UnitChain = { school: null, faculty: null, major: null }
  for (let cur: AcademicUnit | undefined = unit, n = 0; cur && n < 4; cur = cur.parentId ? byId.get(cur.parentId) : undefined, n++) {
    if (cur.type === 'school') chain.school ??= cur
    else if (cur.type === 'major') chain.major ??= cur
    else chain.faculty ??= cur
  }
  return chain
}

// Giá trị lưu vào hồ sơ — khớp view academic_unit_paths ở API (khoa hiển thị bằng tên viết tắt)
export function unitProfileValues(units: AcademicUnit[], unit: AcademicUnit) {
  const c = unitChain(units, unit)
  const facultyUnit = c.faculty ?? (unit.type === 'school' ? unit : null)
  return {
    school: c.school?.name ?? null,
    faculty: facultyUnit ? (facultyUnit.shortName ?? facultyUnit.name) : null,
    major: c.major?.name ?? null
  }
}

// Tìm theo tên / tên viết tắt / tên cấp trên; không từ khóa ⇒ gợi ý trường + ngành
export function searchUnits(units: AcademicUnit[], keyword: string, limit = 12): AcademicUnit[] {
  const q = fold(keyword.trim())
  if (!q) return units.filter((u) => u.type === 'major' || u.type === 'school').slice(0, limit)
  const byId = new Map(units.map((u) => [u.id, u]))
  return units
    .filter((u) => {
      const parent = u.parentId ? byId.get(u.parentId) : undefined
      return [u.name, u.shortName ?? '', parent?.name ?? ''].some((t) => fold(t).includes(q))
    })
    .slice(0, limit)
}

// Dòng phụ dưới tên đơn vị: "Trường • Khoa" chứa nó
export function unitParentLine(units: AcademicUnit[], unit: AcademicUnit): string {
  const c = unitChain(units, unit)
  return [c.school, c.faculty].filter((p): p is AcademicUnit => !!p && p.id !== unit.id).map((p) => p.name).join(' • ')
}
