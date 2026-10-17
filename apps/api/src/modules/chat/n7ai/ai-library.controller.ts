import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiLibraryQuerySchema, type AiLibraryQuery } from '../dto/chat.dto'
import { AiLibraryService } from './ai-library.service'

// Thư viện N7AI: ?kind=image|file|study&cursor=&limit=
@Controller('ai/library')
@UseGuards(AuthenticatedGuard)
export class AiLibraryController {
  constructor(private readonly library: AiLibraryService) {}

  @Get()
  list(@Query(new ZodValidationPipe(AiLibraryQuerySchema)) query: AiLibraryQuery, @Req() req: Request) {
    return this.library.list(requireUserId(req), query)
  }
}
