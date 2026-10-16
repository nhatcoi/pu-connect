import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AI_CONNECTOR_INFO } from '../../ai/ai.retrieval'
import { LlmService } from '../../ai/llm.service'
import { PuaiService } from './puai.service'

@Controller('ai')
@UseGuards(AuthenticatedGuard)
export class PuaiController {
  constructor(
    private readonly puai: PuaiService,
    private readonly llm: LlmService
  ) {}

  // Lượt hỏi PU AI còn lại hôm nay
  @Get('quota')
  quota(@Req() req: Request) {
    return this.llm.quota(requireUserId(req))
  }

  // Connector PU AI đọc được (menu "+")
  @Get('connectors')
  connectors() {
    return AI_CONNECTOR_INFO
  }

  // "Chủ đề mới": làm mới ngữ cảnh hội thoại AI
  @Post('conversations/:id/reset')
  reset(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.puai.resetContext(requireUserId(req), id)
  }
}
