import { Body, Controller, Delete, NotFoundException, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { CreateGroupChatInput, SendMessageInput } from '@pu/schemas'
import { CreateGroupChatBodySchema, MarkReadBodySchema, OpenDirectBodySchema, SendMessageBodySchema } from './dto/chat.dto'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../common/http/current-user'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { ChatService } from './chat.service'
import { PuaiService } from './puai.service'

// Gửi tin qua REST (validate, rate limit, idempotent); socket chỉ đẩy sự kiện xuống
@Controller()
@UseGuards(AuthenticatedGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly puai: PuaiService
  ) {}

  @Get('conversations')
  list(@Req() req: Request) {
    return this.chat.listConversations(requireUserId(req))
  }

  @Get('conversations/unread-count')
  async unread(@Req() req: Request) {
    return { total: await this.chat.unreadTotal(requireUserId(req)) }
  }

  @Post('conversations/direct')
  @HttpCode(HttpStatus.OK)
  openDirect(@Body(new ZodValidationPipe(OpenDirectBodySchema)) body: { userId: string }, @Req() req: Request) {
    return this.chat.openDirect(requireUserId(req), body.userId)
  }

  @Post('conversations/ai')
  @HttpCode(HttpStatus.OK)
  openAi(@Req() req: Request) {
    return this.chat.openAi(requireUserId(req))
  }

  @Post('conversations')
  createGroup(@Body(new ZodValidationPipe(CreateGroupChatBodySchema)) body: CreateGroupChatInput, @Req() req: Request) {
    return this.chat.createGroup(requireUserId(req), body)
  }

  @Get('conversations/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.chat.getConversation(requireUserId(req), id)
  }

  @Get('conversations/:id/messages')
  async messages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: Request
  ) {
    const page = await this.chat.listMessages(requireUserId(req), id, before, limit ? parseInt(limit, 10) || 30 : 30)
    return { success: true, data: page.data, nextCursor: page.nextCursor }
  }

  @Post('conversations/:id/messages')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SendMessageBodySchema)) body: SendMessageInput,
    @Req() req: Request
  ) {
    return this.chat.sendMessage(requireUserId(req), id, body)
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MarkReadBodySchema)) body: { messageId: string },
    @Req() req: Request
  ) {
    return this.chat.markRead(requireUserId(req), id, body.messageId)
  }

  @Post('conversations/:id/leave')
  @HttpCode(HttpStatus.OK)
  leave(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.chat.leaveGroup(requireUserId(req), id)
  }

  @Delete('messages/:id')
  remove(@Param('id') id: string, @Req() req: Request) {
    if (!/^\d+$/.test(id)) throw new NotFoundException('Không tìm thấy tin nhắn')
    return this.chat.deleteMessage(requireUserId(req), id)
  }

  // Lượt hỏi PU AI còn lại hôm nay
  @Get('ai/quota')
  quota(@Req() req: Request) {
    return this.puai.quota(requireUserId(req))
  }
}
