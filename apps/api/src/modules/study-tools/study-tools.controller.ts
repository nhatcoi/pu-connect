import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { StudyAttemptInput, StudyReviewInput, StudySetDraftInput, StudyToolKind } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import {
  StudyAttemptBodySchema,
  StudyReviewBodySchema,
  StudySetBodySchema,
  StudySetDraftBodySchema,
  StudySetListQuerySchema,
  type StudySetBody
} from './dto/study-tools.dto'
import { StudyDraftService } from './study-draft.service'
import { StudyToolsService } from './study-tools.service'

// Công cụ học tập: bộ Flashcard / Quiz (docs/core/15-study-tools.md)
@Controller('tools')
@UseGuards(AuthenticatedGuard)
export class StudyToolsController {
  constructor(
    private readonly tools: StudyToolsService,
    private readonly drafts: StudyDraftService
  ) {}

  @Get('overview')
  overview(@Req() req: Request) {
    return this.tools.overview(requireUserId(req))
  }

  @Get('sets')
  list(@Query(new ZodValidationPipe(StudySetListQuerySchema)) query: { kind?: StudyToolKind; q: string }, @Req() req: Request) {
    return this.tools.list(requireUserId(req), query.kind, query.q)
  }

  @Post('sets')
  create(@Body(new ZodValidationPipe(StudySetBodySchema)) body: StudySetBody, @Req() req: Request) {
    return this.tools.create(requireUserId(req), body)
  }

  // N7AI soạn bản nháp từ chủ đề / nội dung dán vào (chưa lưu, tốn 1 lượt) — khai báo trước ':id'
  @Post('sets/draft')
  draft(@Body(new ZodValidationPipe(StudySetDraftBodySchema)) body: StudySetDraftInput, @Req() req: Request) {
    return this.drafts.draft(requireUserId(req), body.kind, body.prompt)
  }

  @Get('sets/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.tools.get(requireUserId(req), id)
  }

  @Patch('sets/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(StudySetBodySchema)) body: StudySetBody, @Req() req: Request) {
    return this.tools.update(requireUserId(req), id, body)
  }

  @Delete('sets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.tools.remove(requireUserId(req), id)
  }

  // Flashcard: chấm 1 thẻ (Quên / Khó / Nhớ / Dễ) ⇒ lịch ôn kế tiếp
  @Post('sets/:id/review')
  review(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(StudyReviewBodySchema)) body: StudyReviewInput, @Req() req: Request) {
    return this.tools.review(requireUserId(req), id, body.itemId, body.grade)
  }

  // Quiz: ghi kết quả 1 lần làm
  @Post('sets/:id/attempts')
  attempt(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(StudyAttemptBodySchema)) body: StudyAttemptInput, @Req() req: Request) {
    return this.tools.attempt(requireUserId(req), id, body)
  }
}
