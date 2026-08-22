import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    if (req.isAuthenticated && req.isAuthenticated()) {
      return true
    }
    throw new UnauthorizedException('Vui lòng đăng nhập để truy cập tài nguyên này')
  }
}
