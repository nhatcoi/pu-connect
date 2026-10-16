import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AiSkillInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiSkillBodySchema } from '../dto/chat.dto'
import { AiSkillsService } from './ai-skills.service'

// Skill tự tạo cho PU AI (slash command)
@Controller('ai/skills')
@UseGuards(AuthenticatedGuard)
export class AiSkillsController {
  constructor(private readonly skills: AiSkillsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.skills.list(requireUserId(req))
  }

  @Post()
  create(@Body(new ZodValidationPipe(AiSkillBodySchema)) body: AiSkillInput, @Req() req: Request) {
    return this.skills.create(requireUserId(req), body)
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
