import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin.guard'
import { AnnouncementsService } from './announcements.service'
import {
  AnnouncementCreateSchema,
  AnnouncementListQuerySchema,
  AnnouncementPreviewSchema,
  type AnnouncementAudience,
  type AnnouncementCreate
} from './announcements.dto'

@Controller('admin/announcements')
@UseGuards(AdminGuard)
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @RequireAdminPermission('system:broadcast')
  list(@Query(new ZodValidationPipe(AnnouncementListQuerySchema)) q: { status?: string }) {
    return this.announcements.list(q.status)
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('system:broadcast')
  preview(@Body(new ZodValidationPipe(AnnouncementPreviewSchema)) body: { audience: AnnouncementAudience }) {
    return this.announcements.preview(body.audience)
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('system:broadcast')
  create(@Body(new ZodValidationPipe(AnnouncementCreateSchema)) body: AnnouncementCreate, @Req() req: Request) {
    return this.announcements.create(requireUserId(req), body)
  }

  @Delete(':id')
  @RequireAdminPermission('system:broadcast')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.announcements.cancel(requireUserId(req), id)
  }
}

// Web gọi để vẽ banner; khách (chưa đăng nhập) chỉ thấy banner gửi mọi người
@Controller('announcements')
export class PublicAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('active')
  active(@Req() req: Request) {
    return this.announcements.activeBanners((req.user as { id?: string } | undefined)?.id ?? null)
  }
}
