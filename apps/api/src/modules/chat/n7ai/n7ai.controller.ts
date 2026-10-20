import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { AiTemporaryEvent, AiTemporaryInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AiTemporaryBodySchema } from '../dto/ai-temporary.dto'
import { AiTemporaryService } from './ai-temporary.service'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiModelCatalogService } from '../../ai/ai-model-catalog.service'
import { LlmService } from '../../ai/llm.service'
import { N7AiService } from './n7ai.service'

@Controller('ai')
@UseGuards(AuthenticatedGuard)
export class N7AiController {
  constructor(
    private readonly n7ai: N7AiService,
    private readonly llm: LlmService,
    private readonly temporary: AiTemporaryService,
    private readonly models: AiModelCatalogService
  ) {}

  // Lượt hỏi N7AI còn lại hôm nay
  @Get('quota')
  quota(@Req() req: Request) {
    return this.llm.quota(requireUserId(req))
  }

  // Danh mục model người dùng được chọn (do admin quản lý)
  @Get('models')
  modelOptions() {
    return this.models.options()
  }

  // "Chủ đề mới": làm mới ngữ cảnh hội thoại AI
  @Post('conversations/:id/reset')
  reset(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.n7ai.resetContext(requireUserId(req), id)
  }

  // Chat tạm: SSE (progress · delta · done · error), không lưu gì vào hội thoại / bộ nhớ
  @Post('temporary/stream')
  async temporaryStream(@Body(new ZodValidationPipe(AiTemporaryBodySchema)) body: AiTemporaryInput, @Req() req: Request, @Res() res: Response) {
    const userId = requireUserId(req)
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    res.flushHeaders()
    let open = true
    res.on('close', () => (open = false))
    const send = (event: AiTemporaryEvent) => {
      if (open) res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    await this.temporary.stream(userId, body, send)
    res.end()
  }
}
