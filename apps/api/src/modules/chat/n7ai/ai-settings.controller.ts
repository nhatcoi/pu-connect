import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AiFeedbackInput, AiSupportInput, AiTaskInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AdminGuard, RequireAdminPermission } from '../../admin/admin.guard'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import {
  AiFeedbackBodySchema,
  AiMemoryBodySchema,
  AiSettingsBodySchema,
  AiSupportBodySchema,
  AiTaskBodySchema,
  MessageIdParamSchema,
  type AiSettingsBody
} from '../dto/n7ai.dto'
import { AiDataService } from './ai-data.service'
import { AiFeedbackService } from './ai-feedback.service'
import { AiMemoriesService } from './ai-memories.service'
import { AiSettingsService } from './ai-settings.service'
import { AiTasksService } from './ai-tasks.service'

// Cài đặt N7AI: cài đặt chung, bộ nhớ, tác vụ tự động, phản hồi & hỗ trợ, lượt dùng, dữ liệu
@Controller('ai')
@UseGuards(AuthenticatedGuard)
export class AiSettingsController {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly memories: AiMemoriesService,
    private readonly tasks: AiTasksService,
    private readonly feedback: AiFeedbackService,
    private readonly data: AiDataService
  ) {}

  @Get('settings')
  getSettings(@Req() req: Request) {
    return this.settings.get(requireUserId(req))
  }

  @Patch('settings')
  updateSettings(@Body(new ZodValidationPipe(AiSettingsBodySchema)) body: AiSettingsBody, @Req() req: Request) {
    return this.settings.update(requireUserId(req), body)
  }

  // ── Bộ nhớ dài hạn ──
  @Get('memories')
  listMemories(@Req() req: Request) {
    return this.memories.list(requireUserId(req))
  }

  @Post('memories')
  createMemory(@Body(new ZodValidationPipe(AiMemoryBodySchema)) body: { content: string }, @Req() req: Request) {
    return this.memories.create(requireUserId(req), body.content)
  }

  @Patch('memories/:id')
  updateMemory(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiMemoryBodySchema)) body: { content: string }, @Req() req: Request) {
    return this.memories.update(requireUserId(req), id, body.content)
  }

  @Delete('memories/:id')
  removeMemory(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.memories.remove(requireUserId(req), id)
  }

  @Delete('memories')
  clearMemories(@Req() req: Request) {
    return this.memories.clear(requireUserId(req))
  }

  // ── Tác vụ tự động ──
  @Get('tasks')
  listTasks(@Req() req: Request) {
    return this.tasks.list(requireUserId(req))
  }

  @Post('tasks')
  createTask(@Body(new ZodValidationPipe(AiTaskBodySchema)) body: AiTaskInput, @Req() req: Request) {
    return this.tasks.create(requireUserId(req), body)
  }

  @Patch('tasks/:id')
  updateTask(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiTaskBodySchema)) body: AiTaskInput, @Req() req: Request) {
    return this.tasks.update(requireUserId(req), id, body)
  }

  @Delete('tasks/:id')
  removeTask(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.tasks.remove(requireUserId(req), id)
  }

  @Post('tasks/:id/run')
  @HttpCode(HttpStatus.OK)
  runTask(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.tasks.runNow(requireUserId(req), id)
  }

  // ── Phản hồi & hỗ trợ ──
  @Post('messages/:id/feedback')
  @HttpCode(HttpStatus.OK)
  rate(
    @Param('id', new ZodValidationPipe(MessageIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(AiFeedbackBodySchema)) body: AiFeedbackInput,
    @Req() req: Request
  ) {
    return this.feedback.rate(requireUserId(req), id, body)
  }

  @Post('support')
  support(@Body(new ZodValidationPipe(AiSupportBodySchema)) body: AiSupportInput, @Req() req: Request) {
    return this.feedback.support(requireUserId(req), body)
  }

  @Get('usage')
  usage(@Req() req: Request) {
    return this.feedback.usage(requireUserId(req))
  }

  // ── Dữ liệu ──
  @Get('data/export')
  exportData(@Req() req: Request) {
    return this.data.export(requireUserId(req))
  }

  @Delete('data')
  deleteData(@Req() req: Request) {
    return this.data.deleteAll(requireUserId(req))
  }
}

// Admin: thống kê phản hồi N7AI
@Controller('admin')
@UseGuards(AdminGuard)
export class AiAdminController {
  constructor(private readonly feedback: AiFeedbackService) {}

  @Get('ai-feedback')
  @RequireAdminPermission('ai:read')
  stats() {
    return this.feedback.stats()
  }
}
