import type { Course } from '@pu/schemas'

// Màu theo khoa: token --chart-N (globals.css), class viết đủ để Tailwind nhận ra
export const FACULTY_TONES = [
  { bar: 'bg-chart-1', dot: 'bg-chart-1', chip: 'bg-chart-1/10 text-chart-1' },
  { bar: 'bg-chart-2', dot: 'bg-chart-2', chip: 'bg-chart-2/10 text-chart-2' },
  { bar: 'bg-chart-3', dot: 'bg-chart-3', chip: 'bg-chart-3/10 text-chart-3' },
  { bar: 'bg-chart-4', dot: 'bg-chart-4', chip: 'bg-chart-4/10 text-chart-4' },
  { bar: 'bg-chart-5', dot: 'bg-chart-5', chip: 'bg-chart-5/10 text-chart-5' },
  { bar: 'bg-chart-6', dot: 'bg-chart-6', chip: 'bg-chart-6/10 text-chart-6' },
  { bar: 'bg-chart-7', dot: 'bg-chart-7', chip: 'bg-chart-7/10 text-chart-7' },
  { bar: 'bg-chart-8', dot: 'bg-chart-8', chip: 'bg-chart-8/10 text-chart-8' }
] as const

export type FacultyTone = (typeof FACULTY_TONES)[number]

export interface FacultyInfo {
  id: string
  name: string
  tone: FacultyTone
  count: number
}

// "Khoa Điện - Điện tử & Tự động hóa" → "Điện - Điện tử & Tự động hóa"
export const shortFacultyName = (name = '') => name.replace(/^(Khối ngành\s+)?Khoa\s+/i, '').replace(/^Khối ngành\s+/i, '').trim() || name

// Khoa có môn (theo thứ tự tên) kèm màu ổn định và số môn
export function buildFaculties(courses: Course[]): FacultyInfo[] {
  const byId = new Map<string, { name: string; count: number }>()
  for (const c of courses) {
    const cur = byId.get(c.departmentId)
    if (cur) cur.count++
    else byId.set(c.departmentId, { name: shortFacultyName(c.departmentName), count: 1 })
  }
  return [...byId.entries()]
    .sort((a, b) => a[1].name.localeCompare(b[1].name, 'vi'))
    .map(([id, v], i) => ({ id, ...v, tone: FACULTY_TONES[i % FACULTY_TONES.length] }))
}
