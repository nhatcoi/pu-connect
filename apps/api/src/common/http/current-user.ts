import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'

// Lấy user id từ session; KHÔNG bao giờ fallback sang user khác (chống mạo danh)
// Require an authenticated session user — never fall back to another account
export function requireUserId(req: Request, message = 'Vui lòng đăng nhập để thực hiện thao tác'): string {
  const userId = (req.user as { id?: string } | undefined)?.id
  if (!userId) throw new UnauthorizedException(message)
  return userId
}

export function optionalUserId(req: Request): string | null {
  return (req.user as { id?: string } | undefined)?.id || null
}

// Chỉ vai trò được phép (ví dụ admin/giảng viên tạo học phần, sự kiện)
export function requireRole(req: Request, roles: string[]): string {
  const userId = requireUserId(req)
  const role = (req.user as { role?: string } | undefined)?.role
  if (!role || !roles.includes(role)) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này')
  return userId
}
