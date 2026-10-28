import type { Course } from '@pu/schemas'

export interface FieldInfo {
  id: string
  name: string
  count: number
}

// Các lĩnh vực có môn (xếp theo tên) kèm số môn; môn chưa phân loại không vào danh sách
export function buildFields(courses: Course[]): FieldInfo[] {
  const byId = new Map<string, FieldInfo>()
  for (const c of courses) {
    if (!c.fieldId || !c.fieldName) continue
    const cur = byId.get(c.fieldId)
    if (cur) cur.count++
    else byId.set(c.fieldId, { id: c.fieldId, name: c.fieldName, count: 1 })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}
