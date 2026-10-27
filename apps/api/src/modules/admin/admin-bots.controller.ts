import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminBotAccountInput, AdminBotAccountUpdate, AdminBotJobInput, AdminBotJobPatch, AdminBotOverview } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { BotAccountsService } from './bots/bot-accounts.service'
import { BotJobsService } from './bots/bot-jobs.service'
import { BOT_USERNAME, BotAccountCreateSchema, BotAccountUpdateSchema, BotJobCreateSchema, BotJobPatchSchema } from './dto/admin-bots.dto'

const username = (v: string) => (BOT_USERNAME.test(v) ? v : '')

@Controller('admin/bots')
@UseGuards(AdminGuard)
@RequireAdminPermission('bots:manage')
export class AdminBotsController {
  constructor(
    private readonly accounts: BotAccountsService,
    private readonly jobs: BotJobsService
  ) {}

  private async overview(): Promise<AdminBotOverview> {
    const [bots, jobs] = await Promise.all([this.accounts.list(), this.jobs.list()])
    return { bots, jobs }
  }

  @Get()
  get() {
    return this.overview()
  }

  @Post('accounts')
  async createAccount(@Body(new ZodValidationPipe(BotAccountCreateSchema)) body: AdminBotAccountInput, @Req() req: Request) {
    await this.accounts.create(requireUserId(req), body)
    return this.overview()
  }

  @Patch('accounts/:username')
  async updateAccount(@Param('username') name: string, @Body(new ZodValidationPipe(BotAccountUpdateSchema)) body: AdminBotAccountUpdate, @Req() req: Request) {
    await this.accounts.update(requireUserId(req), username(name), body)
    return this.overview()
  }

  @Delete('accounts/:username')
  async deleteAccount(@Param('username') name: string, @Req() req: Request) {
    await this.accounts.remove(requireUserId(req), username(name))
    return this.overview()
  }

  // Tạo job từ file đã parse ở trình duyệt; dryRun=true chỉ kiểm tra từng dòng
  @Post('jobs')
  @HttpCode(HttpStatus.OK)
  createJob(@Body(new ZodValidationPipe(BotJobCreateSchema)) body: AdminBotJobInput, @Req() req: Request) {
    return this.jobs.create(requireUserId(req), body)
  }

  @Get('jobs/:id')
  jobDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.detail(id)
  }

  @Patch('jobs/:id')
  async patchJob(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(BotJobPatchSchema)) body: AdminBotJobPatch, @Req() req: Request) {
    await this.jobs.patch(requireUserId(req), id, body)
    return this.overview()
  }

  @Delete('jobs/:id')
  async deleteJob(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.jobs.remove(requireUserId(req), id)
    return this.overview()
  }

  @Post('jobs/:id/posts/:postId/publish')
  @HttpCode(HttpStatus.OK)
  async publishNow(@Param('id', ParseUUIDPipe) id: string, @Param('postId', ParseIntPipe) postId: number, @Req() req: Request) {
    await this.jobs.publishNow(requireUserId(req), id, postId)
    return this.jobs.detail(id)
  }

  @Delete('jobs/:id/posts/:postId')
  async removePost(@Param('id', ParseUUIDPipe) id: string, @Param('postId', ParseIntPipe) postId: number, @Req() req: Request) {
    await this.jobs.removePost(requireUserId(req), id, postId)
    return this.jobs.detail(id)
  }
}
