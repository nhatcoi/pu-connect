import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AiThreadUpdateInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { ConversationsService } from '../conversations/conversations.service'
import { AiThreadUpdateBodySchema, ListAiThreadsQuerySchema, type ListAiThreadsQuery } from '../dto/chat.dto'
import { AiThreadShareService } from './ai-thread-share.service'
import { AiThreadsService } from './ai-threads.service'

// Lịch sử hội thoại N7AI (nhiều thread)
@Controller('ai/threads')
@UseGuards(AuthenticatedGuard)
export class AiThreadsController {
  constructor(
    private readonly threads: AiThreadsService,
    private readonly conversations: ConversationsService,
    private readonly shares: AiThreadShareService
  ) {}

  // ?q=&cursor=&limit= (keyset, hoạt động gần nhất trước)
  @Get()
  list(@Query(new ZodValidationPipe(ListAiThreadsQuerySchema)) query: ListAiThreadsQuery, @Req() req: Request) {
    return this.threads.list(requireUserId(req), query)
  }

  // "Chat mới": dùng lại thread rỗng nếu có
  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Req() req: Request) {
    return this.conversations.createAiThread(requireUserId(req))
  }

  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiThreadUpdateBodySchema)) body: AiThreadUpdateInput, @Req() req: Request) {
    return this.threads.rename(requireUserId(req), id, body.title)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.threads.remove(requireUserId(req), id)
  }

  // Chia sẻ công khai qua link: trạng thái / tạo hoặc cập nhật ảnh chụp / ngắt
  @Get(':id/share')
  getShare(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.shares.get(requireUserId(req), id)
  }

  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  share(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.shares.share(requireUserId(req), id)
  }

  @Delete(':id/share')
  unshare(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.shares.unshare(requireUserId(req), id)
  }
}
