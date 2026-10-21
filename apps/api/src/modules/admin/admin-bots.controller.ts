import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminBotAccountInput, AdminBotAccountUpdate, BotGenerateContentInput, BotImportInput, BotImportMapRequest, AdminBotCommandInput, AdminBotControlInput, AdminBotProfileInput, AdminBotTopicInput } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminBotsService } from './admin-bots.service'
import { BotImportService } from './bot-import/bot-import.service'
import {
  BotAccountCreateSchema,
  BotImportBodySchema,
  BotImportMapBodySchema,
  BotAccountUpdateSchema,
  BotActivityQuerySchema,
  BotCommandBodySchema,
  BotControlBodySchema,
  BotGenerateContentSchema,
  BotProfileBodySchema,
  BotTopicBodySchema,
  type BotActivityQuery
} from './dto/admin-bots.dto'

const USERNAME = /^[a-zA-Z0-9._]{1,40}$/

@Controller('admin/bots')
@UseGuards(AdminGuard)
@RequireAdminPermission('bots:manage')
export class AdminBotsController {
  constructor(
    private readonly bots: AdminBotsService,
    private readonly importer: BotImportService
  ) {}

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

  @Patch('profiles/:username')
  profile(@Param('username') username: string, @Body(new ZodValidationPipe(BotProfileBodySchema)) body: AdminBotProfileInput, @Req() req: Request) {
    return this.bots.updateProfile(requireUserId(req), USERNAME.test(username) ? username : '', body)
  }

  @Put('topics')
  upsertTopic(@Body(new ZodValidationPipe(BotTopicBodySchema)) body: AdminBotTopicInput, @Req() req: Request) {
    return this.bots.upsertTopic(requireUserId(req), body)
  }

  @Delete('topics/:slug')
  deleteTopic(@Param('slug') slug: string, @Req() req: Request) {
    return this.bots.deleteTopic(requireUserId(req), slug)
  }

  @Post('accounts')
  createAccount(@Body(new ZodValidationPipe(BotAccountCreateSchema)) body: AdminBotAccountInput, @Req() req: Request) {
    return this.bots.createAccount(requireUserId(req), body)
  }

  @Patch('accounts/:username')
  updateAccount(@Param('username') username: string, @Body(new ZodValidationPipe(BotAccountUpdateSchema)) body: AdminBotAccountUpdate, @Req() req: Request) {
    return this.bots.updateAccount(requireUserId(req), USERNAME.test(username) ? username : '', body)
  }

  @Delete('accounts/:username')
  deleteAccount(@Param('username') username: string, @Req() req: Request) {
    return this.bots.deleteAccount(requireUserId(req), USERNAME.test(username) ? username : '')
  }

  @Delete('commands/:id')
  cancelCommand(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.bots.cancelCommand(requireUserId(req), id)
  }

  @Post('import')
  importRows(@Body(new ZodValidationPipe(BotImportBodySchema)) body: BotImportInput, @Req() req: Request) {
    return this.importer.import(requireUserId(req), body)
  }

  @Post('import/map-columns')
  mapColumns(@Body(new ZodValidationPipe(BotImportMapBodySchema)) body: BotImportMapRequest) {
    return this.importer.mapColumns(body)
  }

  @Get('recent-posts')
  recentPosts() {
    return this.bots.recentPosts()
  }

  @Post('generate-content')
  generateContent(@Body(new ZodValidationPipe(BotGenerateContentSchema)) body: BotGenerateContentInput) {
    return this.bots.generateContent(body)
  }

  @Post('commands')
  @HttpCode(HttpStatus.ACCEPTED)
  command(@Body(new ZodValidationPipe(BotCommandBodySchema)) body: AdminBotCommandInput, @Req() req: Request) {
    return this.bots.enqueue(requireUserId(req), body)
  }
}
