import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { z } from 'zod'
import { requireUserId } from '../../../common/http/current-user'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin.guard'
import { AdminModerationEventsService, type ModerationEventsQuery } from './moderation-events.service'

const empty = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' ? undefined : v), s.optional())
const QuerySchema = z.object({
  status: z.enum(['pending', 'reviewed']).default('pending'),
  action: empty(z.enum(['block', 'hold', 'flag'])),
  surface: empty(z.enum(['post', 'comment'])),
  q: empty(z.string().trim().max(64)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})
const ReviewSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), resolution: z.enum(['confirmed', 'dismissed']) }).strict()

@Controller('admin/moderation-events')
@UseGuards(AdminGuard)
export class AdminModerationEventsController {
  constructor(private readonly events: AdminModerationEventsService) {}

  @Get()
  @RequireAdminPermission('moderation:read')
  list(@Query(new ZodValidationPipe(QuerySchema)) q: ModerationEventsQuery) {
    return this.events.list(q)
  }

  @Post('review')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  review(@Body(new ZodValidationPipe(ReviewSchema)) body: { ids: string[]; resolution: 'confirmed' | 'dismissed' }, @Req() req: Request) {
    return this.events.review(requireUserId(req), body.ids, body.resolution)
  }
}
