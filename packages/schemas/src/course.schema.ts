import { z } from 'zod'

export const DepartmentSchema = z.object({
  id: z.string(),
  code: z.string(), // e.g. "CNTT", "KHMT", "QTKD"
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

// Đề xuất môn học: người dùng gợi ý, admin duyệt (duyệt ⇒ tạo môn thật)
export type CourseSuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface CourseSuggestion {
  id: string
  name: string
  code: string | null
  facultyCode: string | null
  credits: number | null
  note: string | null
  status: CourseSuggestionStatus
  reviewNote: string | null
  // Môn đã tạo khi được duyệt
  courseId: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface CourseSuggestionInput {
  name: string
  code?: string
  facultyCode?: string
  credits?: number
  note?: string
}

export interface AdminCourseSuggestion extends CourseSuggestion {
  requester: { id: string; username: string; displayName: string }
}
