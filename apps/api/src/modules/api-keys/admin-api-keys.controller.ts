import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { z } from 'zod'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin/admin.guard'
import { ADMIN_KEY_SCOPES } from './api-key.scopes'
import { ApiKeysService } from './api-keys.service'

const CreateAdminKeySchema = z.object({
  name: z.string().trim().min(1, { message: 'Đặt tên cho key' }).max(80),
  scopes: z.array(z.enum(ADMIN_KEY_SCOPES)).min(1),
  expiresInDays: z.number().int().min(1).max(30).nullish(),
  ipAllow: z.array(z.string().trim().min(3).max(64)).max(10).nullish()
})
type CreateAdminKeyBody = z.infer<typeof CreateAdminKeySchema>

// Key MCP cho admin: chỉ tạo/thu hồi bằng phiên đăng nhập của admin có quyền roles:manage (key không tự quản lý key)
@Controller('admin/api-keys')
@UseGuards(AdminGuard)
@RequireAdminPermission('roles:manage')
export class AdminApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@Req() req: Request) {
    return this.keys.list(requireUserId(req), 'admin')
  }

  @Get('logs')
  logs(@Req() req: Request) {
    return this.keys.logs(requireUserId(req), 'admin')
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateAdminKeySchema)) body: CreateAdminKeyBody, @Req() req: Request) {
    return this.keys.create(requireUserId(req), body as { name: string; scopes: string[]; expiresInDays?: number | null; ipAllow?: string[] | null }, 'admin')
  }

  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.keys.revoke(requireUserId(req), id)
  }
}
