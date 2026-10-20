import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminBotCommandInput, AdminBotControlInput } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminBotsService } from './admin-bots.service'
import { BotActivityQuerySchema, BotCommandBodySchema, BotControlBodySchema, type BotActivityQuery } from './dto/admin-bots.dto'

@Controller('admin/bots')
@UseGuards(AdminGuard)
@RequireAdminPermission('bots:manage')
export class AdminBotsController {
  constructor(private readonly bots: AdminBotsService) {}

  @Get()
  overview() {
    return this.bots.overview()
  }

  @Get('activity')
  activity(@Query(new ZodValidationPipe(BotActivityQuerySchema)) q: BotActivityQuery) {
    return this.bots.activity(q)
  }

  @Patch('control')
  control(@Body(new ZodValidationPipe(BotControlBodySchema)) body: AdminBotControlInput, @Req() req: Request) {
    return this.bots.setControl(requireUserId(req), body)
  }

  @Post('commands')
  @HttpCode(HttpStatus.ACCEPTED)
  command(@Body(new ZodValidationPipe(BotCommandBodySchema)) body: AdminBotCommandInput, @Req() req: Request) {
    return this.bots.enqueue(requireUserId(req), body)
  }
}
