import { z } from 'zod'

export const DepartmentSchema = z.object({
  id: z.string(),
  code: z.string(), // e.g. "FIT", "FET", "FBA", "FEE"
  name: z.string(), // e.g. "Khoa Công nghệ Thông tin", "Khoa Điện - Điện tử"
  icon: z.string().optional(),
  description: z.string().optional()
})

export const CourseSchema = z.object({
  id: z.string(),
  code: z.string(), // e.g. "IT101", "PHY102", "MATH201"
  name: z.string(), // e.g. "Cấu trúc dữ liệu và Giải thuật"
  credits: z.number().min(1).max(10),
  departmentId: z.string(),
  departmentName: z.string().optional(),
  semester: z.string().optional(), // e.g. "Học kỳ 1 (2025-2026)"
  description: z.string().optional(),
  lecturerName: z.string().optional(),
  documentCount: z.number().default(0),
  postCount: z.number().default(0),
  rating: z.number().min(0).max(5).default(5)
})

export const CreateCourseSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(100),
  credits: z.number().min(1).max(10),
  departmentId: z.string(),
  description: z.string().optional()
})

export type Department = z.infer<typeof DepartmentSchema>
export type Course = z.infer<typeof CourseSchema>
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>

// Trang học phần /courses/[code]
export interface CourseOverview {
  course: Course
  stats: {
    questionCount: number
    solvedCount: number
    documentCount: number
    groupCount: number
    recruitingGroupCount: number
  }
  topContributors: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    role: string
    contributions: number
  }[]
}
