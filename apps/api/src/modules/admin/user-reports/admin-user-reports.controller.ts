import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { z } from 'zod'
import { requireUserId } from '../../../common/http/current-user'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin.guard'
import { AdminUserReportsService, type UserReportsQuery } from './admin-user-reports.service'

const REASONS = ['spam', 'exam_leak', 'harassment', 'inaccurate_info', 'other'] as const
const QuerySchema = z.object({
  status: z.enum(['pending', 'resolved']).default('pending'),
  reason: z.preprocess((v) => (v === '' ? undefined : v), z.enum(REASONS).optional()),
  q: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(64).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})
const ResolveSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), resolution: z.enum(['actioned', 'dismissed']) }).strict()

@Controller('admin/user-reports')
@UseGuards(AdminGuard)
export class AdminUserReportsController {
  constructor(private readonly reports: AdminUserReportsService) {}

  @Get()
  @RequireAdminPermission('moderation:read')
  list(@Query(new ZodValidationPipe(QuerySchema)) q: UserReportsQuery) {
    return this.reports.list(q)
  }

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  resolve(@Body(new ZodValidationPipe(ResolveSchema)) body: { ids: string[]; resolution: 'actioned' | 'dismissed' }, @Req() req: Request) {
    return this.reports.resolve(requireUserId(req), body.ids, body.resolution)
  }
}
