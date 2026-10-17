import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { AiSuggestionsService } from './ai-suggestions.service'
import { SuggestionsQuerySchema, TrackEventsBodySchema, type SuggestionsQuery, type TrackEventsBody } from './dto/personalization.dto'
import { UserEventsService } from './user-events.service'

@Controller()
@UseGuards(AuthenticatedGuard)
export class PersonalizationController {
  constructor(
    private readonly events: UserEventsService,
    private readonly suggestions: AiSuggestionsService
  ) {}

  // Lô sự kiện hành vi từ client (fire-and-forget)
  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  track(@Body(new ZodValidationPipe(TrackEventsBodySchema)) body: TrackEventsBody, @Req() req: Request) {
    return this.events.track(requireUserId(req), body)
  }

  // Gợi ý mở đầu N7AI theo chế độ học
  @Get('ai/suggestions')
  suggest(@Query(new ZodValidationPipe(SuggestionsQuerySchema)) query: SuggestionsQuery, @Req() req: Request) {
    return this.suggestions.suggest(requireUserId(req), query.mode)
  }
}
