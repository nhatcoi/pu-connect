import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'

// Chỉ admin hệ thống (role = 'admin') được vào /api/admin/*
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as { id?: string; role?: string } | undefined
    if (!user?.id) throw new UnauthorizedException('Vui lòng đăng nhập để truy cập tài nguyên này')
    if (user.role !== 'admin') throw new ForbiddenException('Chỉ quản trị viên mới truy cập được')
    return true
  }
}
