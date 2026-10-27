import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AdminPermission } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { effectivePermissions } from './admin-permissions'

export const ADMIN_PERMISSION_KEY = 'admin_permission'

// Gắn quyền cụ thể cho từng endpoint trong /api/admin/*
export const RequireAdminPermission = (permission: AdminPermission) => SetMetadata(ADMIN_PERMISSION_KEY, permission)

// Bảo vệ toàn bộ /api/admin/*: quyền = vai trò + nhóm quyền (chi tiết theo endpoint)
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest().user as { id?: string; role?: string } | undefined
    if (!user?.id) throw new UnauthorizedException('Vui lòng đăng nhập để truy cập cổng quản trị')

    const requiredPermission =
      this.reflector.getAllAndOverride<AdminPermission | undefined>(ADMIN_PERMISSION_KEY, [context.getHandler(), context.getClass()]) ||
      'dashboard:view'

    const perms = await effectivePermissions(this.db, user.id, user.role)
    if (!perms.includes(requiredPermission)) {
      throw new ForbiddenException(`Bạn không có quyền thực hiện thao tác này (${requiredPermission})`)
    }
    return true
  }
}
