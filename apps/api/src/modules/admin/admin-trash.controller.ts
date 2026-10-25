import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminTrashService } from './admin-trash.service'

@Controller('admin/trash')
@UseGuards(AdminGuard)
export class AdminTrashController {
  constructor(private readonly trash: AdminTrashService) {}

  @Get()
  @RequireAdminPermission('moderation:read')
  list(@Query('table') table?: string) {
    return this.trash.list(table)
  }

  @Post(':batch/restore')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  restore(@Param('batch') batch: string, @Req() req: Request) {
    return this.trash.restore(requireUserId(req), batch.replace(/\D/g, ''))
  }
}
