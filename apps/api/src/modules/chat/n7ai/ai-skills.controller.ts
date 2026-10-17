import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AiSkillDraftInput, AiSkillInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiSkillBodySchema, SkillLibraryQuerySchema } from '../dto/chat.dto'
import { AiSkillDraftBodySchema, AiSkillStateBodySchema } from '../dto/n7ai.dto'
import { AiSkillDraftService } from './ai-skill-draft.service'
import { AiSkillsService } from './ai-skills.service'

// Skill tự tạo cho N7AI (slash command)
@Controller('ai/skills')
@UseGuards(AuthenticatedGuard)
export class AiSkillsController {
  constructor(
    private readonly skills: AiSkillsService,
    private readonly drafts: AiSkillDraftService
  ) {}

  @Get()
  list(@Req() req: Request) {
    return this.skills.list(requireUserId(req))
  }

  @Post()
  create(@Body(new ZodValidationPipe(AiSkillBodySchema)) body: AiSkillInput, @Req() req: Request) {
    return this.skills.create(requireUserId(req), body)
  }

  // Tạo nhanh: N7AI viết bản nháp từ mô tả (chưa lưu, tốn 1 lượt)
  @Post('draft')
  draft(@Body(new ZodValidationPipe(AiSkillDraftBodySchema)) body: AiSkillDraftInput, @Req() req: Request) {
    return this.drafts.draft(requireUserId(req), body.prompt)
  }

  // Thư viện skill công khai (khai báo trước ':id')
  @Get('library')
  library(@Query(new ZodValidationPipe(SkillLibraryQuerySchema)) query: { q: string }, @Req() req: Request) {
    return this.skills.library(requireUserId(req), query.q)
  }

  // Cài skill công khai về skill của mình
  @Post(':id/install')
  install(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.skills.install(requireUserId(req), id)
  }

  // Bật/tắt, ghim
  @Patch(':id/state')
  setState(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AiSkillStateBodySchema)) body: { enabled?: boolean; pinned?: boolean },
    @Req() req: Request
  ) {
    return this.skills.setState(requireUserId(req), id, body)
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.skills.get(requireUserId(req), id)
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiSkillBodySchema)) body: AiSkillInput, @Req() req: Request) {
    return this.skills.update(requireUserId(req), id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.skills.remove(requireUserId(req), id)
  }
}
