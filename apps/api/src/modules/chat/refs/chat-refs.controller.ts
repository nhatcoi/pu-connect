import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { RefSuggestQuerySchema, type RefSuggestQuery } from '../dto/chat.dto'
import { ChatRefsService } from './chat-refs.service'

// Gợi ý ngữ cảnh cho ô soạn tin ("@" / "+ Ngữ cảnh")
@Controller('chat/refs')
@UseGuards(AuthenticatedGuard)
export class ChatRefsController {
  constructor(private readonly refs: ChatRefsService) {}

  // ?q=&types=course,document,post,thread
  @Get()
  suggest(@Query(new ZodValidationPipe(RefSuggestQuerySchema)) query: RefSuggestQuery, @Req() req: Request) {
    return this.refs.suggest(requireUserId(req), query.q, query.types)
  }
}
