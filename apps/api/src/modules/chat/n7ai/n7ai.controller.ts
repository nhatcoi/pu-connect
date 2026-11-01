import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { AiSuggestionsService } from './ai-suggestions.service'
import { optionalUserId, requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiModelCatalogService } from '../../ai/ai-model-catalog.service'
import { LlmService } from '../../ai/llm.service'
import { N7AiService } from './n7ai.service'

@Controller('ai')
export class N7AiController {
  constructor(
    private readonly n7ai: N7AiService,
    private readonly llm: LlmService,
    private readonly models: AiModelCatalogService,
    private readonly suggestions: AiSuggestionsService
  ) {}

  // Lượt hỏi N7AI còn lại hôm nay
  @Get('quota')
  @UseGuards(AuthenticatedGuard)
  quota(@Req() req: Request) {
    return this.llm.quota(requireUserId(req))
  }

  // Gợi ý ý tưởng học tập động (Ideas for you)
  // Hỗ trợ cả người dùng đăng nhập lẫn khách/chat tạm
  @Get('ideas')
  getIdeas(@Req() req: Request, @Query('mode') mode?: string) {
    return this.suggestions.get(optionalUserId(req), mode)
  }

  @Post('ideas/refresh')
  refreshIdeas(@Req() req: Request, @Body('mode') mode?: string) {
    return this.suggestions.refresh(optionalUserId(req), mode)
  }

  // Alias để tương thích đường dẫn API cũ
  @Get('suggestions/ideas')
  getSuggestionsIdeas(@Req() req: Request, @Query('mode') mode?: string) {
    return this.suggestions.get(optionalUserId(req), mode)
  }

  // Danh mục model người dùng được chọn (do admin quản lý)
  @Get('models')
  modelOptions() {
    return this.models.options()
  }

  // "Chủ đề mới": làm mới ngữ cảnh hội thoại AI
  @Post('conversations/:id/reset')
  @UseGuards(AuthenticatedGuard)
  reset(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.n7ai.resetContext(requireUserId(req), id)
  }
}
