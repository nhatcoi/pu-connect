import { ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

// Không ném lỗi khi OAuth thất bại: controller sẽ redirect về trang đăng nhập kèm thông báo.
// Lý do lỗi được ghi log (không ghi code/state/secret) để chẩn đoán.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleAuthGuard.name)

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = (await super.canActivate(context)) as boolean
      // Bắt buộc: tạo phiên đăng nhập (passport không tự gọi logIn khi dùng guard của Nest)
      await super.logIn(context.switchToHttp().getRequest())
      return result
    } catch (err: any) {
      const req = context.switchToHttp().getRequest()
      // 403 = tài khoản bị khóa ⇒ báo riêng cho người dùng
      req.googleAuthFailed = err?.status === 403 ? 'suspended' : true
      const googleError = typeof req.query?.error === 'string' ? req.query.error : undefined
      const detail = err?.oauthError?.data ? ` | oauth: ${String(err.oauthError.data).slice(0, 300)}` : ''
      this.logger.warn(
        `Google OAuth thất bại: ${err?.name || 'Error'}: ${err?.message || 'unknown'}` + `${googleError ? ` | google_error=${googleError}` : ''}${detail}`
      )
      return true
    }
  }
}
