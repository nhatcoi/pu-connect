import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SecurityLogService } from '../security-log.service'

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor(private readonly securityLog: SecurityLogService) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    try {
      const result = (await super.canActivate(context)) as boolean
      await super.logIn(request)
      return result
    } catch (err) {
      // Nhật ký: đăng nhập sai / bị chặn (chỉ ghi khi tài khoản tồn tại)
      const identifier = String(request.body?.emailOrUsername ?? '')
      if (identifier) void this.securityLog.recordFailedLogin(request, identifier, (err as { status?: number })?.status === 403)
      throw err
    }
  }
}
