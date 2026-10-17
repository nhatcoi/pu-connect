import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

type MaybeRestricted = { isRestricted?: boolean; restrictedUntil?: string | null } | undefined | null

// Tài khoản bị hạn chế (chỉ đọc): không tạo / sửa nội dung, không nhắn tin
export function assertNotRestricted(user: MaybeRestricted): void {
  if (!user?.isRestricted) return
  const until = user.restrictedUntil
    ? ` đến ${new Date(user.restrictedUntil).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
    : ''
  throw new ForbiddenException(`Tài khoản của bạn đang bị hạn chế${until}: chỉ xem, chưa thể đăng bài, bình luận hay nhắn tin.`)
}

// Gắn vào handler ghi nội dung (sau AuthenticatedGuard); req.user lấy từ session (deserializeUser)
@Injectable()
export class NotRestrictedGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    assertNotRestricted(ctx.switchToHttp().getRequest().user)
    return true
  }
}
