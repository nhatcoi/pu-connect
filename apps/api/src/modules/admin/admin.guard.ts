import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AdminPermission } from '@pu/schemas'
import { hasRolePermission } from './dto/admin.dto'

export const ADMIN_PERMISSION_KEY = 'admin_permission'

// Gắn quyền cụ thể cho từng endpoint trong /api/admin/*
export const RequireAdminPermission = (permission: AdminPermission) => SetMetadata(ADMIN_PERMISSION_KEY, permission)

// Bảo vệ toàn bộ /api/admin/* — chỉ role admin (quyền chi tiết theo endpoint)
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as { id?: string; role?: string } | undefined
    if (!user?.id) throw new UnauthorizedException('Vui lòng đăng nhập để truy cập cổng quản trị')

    const requiredPermission =
      this.reflector.getAllAndOverride<AdminPermission | undefined>(ADMIN_PERMISSION_KEY, [context.getHandler(), context.getClass()]) ||
      'dashboard:view'

    if (!hasRolePermission(user.role, requiredPermission)) {
      throw new ForbiddenException(`Bạn không có quyền thực hiện thao tác này (${requiredPermission})`)
    }
    return true
  }
}
