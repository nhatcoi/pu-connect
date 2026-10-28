import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AiSourceCollectionInput, AiSourceInput, AiSourcePatch } from '@pu/schemas'
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../../common/http/current-user'
import { AuthenticatedGuard } from '../../../auth/guards/authenticated.guard'
import { AiSourceBodySchema, AiSourceCollectionBodySchema, AiSourcePatchBodySchema, AiSourcesQuerySchema } from '../../dto/chat.dto'
import { AiSourcesService } from './ai-sources.service'

// Tài liệu của cuộc trò chuyện N7AI (?threadId=) hoặc của thư viện (không có threadId)
@Controller('ai/sources')
@UseGuards(AuthenticatedGuard)
export class AiSourcesController {
  constructor(private readonly sources: AiSourcesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(AiSourcesQuerySchema)) query: { threadId?: string }, @Req() req: Request) {
    return this.sources.list(requireUserId(req), query.threadId)
  }

  @Get(':id/content')
  content(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sources.content(requireUserId(req), id)
  }

  @Post()
  add(@Body(new ZodValidationPipe(AiSourceBodySchema)) body: AiSourceInput, @Req() req: Request) {
    return this.sources.add(requireUserId(req), body)
  }

  @Post('collection')
  addCollection(@Body(new ZodValidationPipe(AiSourceCollectionBodySchema)) body: AiSourceCollectionInput, @Req() req: Request) {
    return this.sources.addCollection(requireUserId(req), body)
  }

  @Patch(':id')
  patch(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiSourcePatchBodySchema)) body: AiSourcePatch, @Req() req: Request) {
    return this.sources.patch(requireUserId(req), id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sources.remove(requireUserId(req), id)
  }
}
