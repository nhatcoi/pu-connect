import { z } from 'zod'

// Trang quản trị tối giản: báo cáo, khóa tài khoản, nhật ký thao tác
export const AdminReasonSchema = z.object({
  reason: z.string().trim().max(255).optional()
})
export type AdminReasonInput = z.infer<typeof AdminReasonSchema>

export interface AdminStats {
  pendingReports: number
  reportedPosts: number
  hiddenPosts: number
  totalUsers: number
  suspendedUsers: number
  newUsers7d: number
}

export interface AdminReportedPost {
  postId: string
  title: string
  content: string
  createdAt: string
  hiddenAt: string | null
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; status: string }
  reportCount: number
  reasons: { reason: string; count: number }[]
  details: string[]
  lastReportedAt: string
}

export interface AdminUserRow {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  role: string
  status: string
  suspendedAt: string | null
  suspendedReason: string | null
  postCount: number
  reportCount: number
  createdAt: string
}

export interface AdminAuditLog {
  id: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown> | null
  createdAt: string
  admin: { id: string; username: string; displayName: string } | null
}

export interface ZeroResultQuery {
  query: string
  count: number
  lastSearchedAt: string
}
