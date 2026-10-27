import type { Course } from '@pu/schemas'

export interface FacultyInfo {
  id: string
  name: string
  count: number
}

// "Khoa Điện - Điện tử & Tự động hóa" → "Điện - Điện tử & Tự động hóa"
export const shortFacultyName = (name = '') =>
  name
    .replace(/^(Khối ngành\s+)?Khoa\s+/i, '')
    .replace(/^Khối ngành\s+/i, '')
    .trim() || name

// Các khoa có môn (xếp theo tên) kèm số môn
export function buildFaculties(courses: Course[]): FacultyInfo[] {
  const byId = new Map<string, FacultyInfo>()
  for (const c of courses) {
    const cur = byId.get(c.departmentId)
    if (cur) cur.count++
    else byId.set(c.departmentId, { id: c.departmentId, name: shortFacultyName(c.departmentName), count: 1 })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}
