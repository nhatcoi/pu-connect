import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminReasonInput } from '@pu/schemas'
import { AdminReasonBodySchema } from './dto/admin.dto'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../common/http/current-user'
import { AdminGuard } from './admin.guard'
import { AdminService } from './admin.service'

const toInt = (v: string | undefined, fallback: number) => {
  const n = parseInt(v || '', 10)
  return Number.isFinite(n) ? n : fallback
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.getStats()
  }

  // Báo cáo vi phạm gom theo bài viết
  @Get('reports')
  reports(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.admin.listReports(status === 'resolved' ? 'resolved' : 'pending', toInt(limit, 50))
  }

  @Post('posts/:id/hide')
  @HttpCode(HttpStatus.OK)
  hidePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminReasonBodySchema)) body: AdminReasonInput,
    @Req() req: Request
  ) {
    return this.admin.hidePost(requireUserId(req), id, body.reason)
  }

  @Post('posts/:id/unhide')
  @HttpCode(HttpStatus.OK)
  unhidePost(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.unhidePost(requireUserId(req), id)
  }

  @Post('posts/:id/dismiss-reports')
  @HttpCode(HttpStatus.OK)
  dismissReports(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.dismissReports(requireUserId(req), id)
  }

  @Get('users')
  users(@Query('q') q?: string, @Query('status') status?: string, @Query('limit') limit?: string) {
    return this.admin.listUsers(q, status, toInt(limit, 50))
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminReasonBodySchema)) body: AdminReasonInput,
    @Req() req: Request
  ) {
    return this.admin.suspendUser(requireUserId(req), id, body.reason)
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  unsuspend(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.unsuspendUser(requireUserId(req), id)
  }

  @Get('audit-logs')
  auditLogs(@Query('limit') limit?: string) {
    return this.admin.listAuditLogs(toInt(limit, 50))
  }

  // Từ khóa tìm kiếm không có kết quả (gợi ý nội dung còn thiếu)
  @Get('search/zero-results')
  zeroResults(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.admin.zeroResultQueries(toInt(days, 30), toInt(limit, 50))
  }
}
