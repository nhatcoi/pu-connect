import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common'
import type { Request } from 'express'
import type { EditMessageInput, SendMessageInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { EditMessageBodySchema, ReactBodySchema, SendMessageBodySchema } from '../dto/chat.dto'
import { MessagesService } from './messages.service'

// id tin nhắn là BIGSERIAL
const messageId = (id: string) => {
  if (!/^\d+$/.test(id)) throw new NotFoundException('Không tìm thấy tin nhắn')
  return id
}

// Gửi tin qua REST (validate, rate limit, idempotent); socket chỉ đẩy sự kiện xuống
@Controller()
@UseGuards(AuthenticatedGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations/:id/messages')
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: Request
  ) {
    const page = await this.messages.list(requireUserId(req), id, before, limit ? parseInt(limit, 10) || 30 : 30)
    return { success: true, data: page.data, nextCursor: page.nextCursor }
  }

  @Post('conversations/:id/messages')
  send(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(SendMessageBodySchema)) body: SendMessageInput, @Req() req: Request) {
    return this.messages.send(requireUserId(req), id, body)
  }

  @Get('conversations/:id/messages/search')
  search(@Param('id', ParseUUIDPipe) id: string, @Query('q') q: string | undefined, @Req() req: Request) {
    return this.messages.search(requireUserId(req), id, q || '')
  }

  @Get('conversations/:id/pinned')
  pinned(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.messages.listPinned(requireUserId(req), id)
  }

  // Kho ảnh & tệp (kind=image|file)
  @Get('conversations/:id/attachments')
  attachments(@Param('id', ParseUUIDPipe) id: string, @Query('kind') kind: string | undefined, @Req() req: Request) {
    return this.messages.listAttachments(requireUserId(req), id, kind)
  }

  @Patch('messages/:id')
  edit(@Param('id') id: string, @Body(new ZodValidationPipe(EditMessageBodySchema)) body: EditMessageInput, @Req() req: Request) {
    return this.messages.edit(requireUserId(req), messageId(id), body)
  }

  @Delete('messages/:id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.messages.remove(requireUserId(req), messageId(id))
  }

  @Post('messages/:id/reactions')
  @HttpCode(HttpStatus.OK)
  react(@Param('id') id: string, @Body(new ZodValidationPipe(ReactBodySchema)) body: { emoji: string }, @Req() req: Request) {
    return this.messages.react(requireUserId(req), messageId(id), body.emoji)
  }

  @Get('messages/:id/reactions')
  reactions(@Param('id') id: string, @Req() req: Request) {
    return this.messages.listReactions(requireUserId(req), messageId(id))
  }

  @Post('messages/:id/pin')
  @HttpCode(HttpStatus.OK)
  pin(@Param('id') id: string, @Req() req: Request) {
    return this.messages.togglePin(requireUserId(req), messageId(id))
  }
}
