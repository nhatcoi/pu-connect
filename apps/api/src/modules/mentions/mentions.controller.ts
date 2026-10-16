import { Controller, Get, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { requireUserId } from '../../common/http/current-user'
import { MentionSuggestService, normalizeMentionQuery } from './mention-suggest.service'

@Controller('mentions')
export class MentionsController {
  constructor(private readonly suggestService: MentionSuggestService) {}

  // Gợi ý @mention khi gõ (debounce phía client)
  @Get('suggest')
  @UseGuards(AuthenticatedGuard)
  async suggest(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('postId', new ParseUUIDPipe({ optional: true })) postId?: string
  ) {
    return this.suggestService.suggest(requireUserId(req), normalizeMentionQuery(q), postId ?? null)
  }
}
