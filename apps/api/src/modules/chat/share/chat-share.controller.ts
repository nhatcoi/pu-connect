import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { SharePostInput } from '@pu/schemas'
import { NotRestrictedGuard } from '../../../common/guards/not-restricted.guard'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { SharePostBodySchema } from '../dto/chat.dto'
import { ChatShareService } from './chat-share.service'

// Chia sẻ nội dung vào chat (hiện: bài viết)
@Controller('chat/share')
@UseGuards(AuthenticatedGuard)
export class ChatShareController {
  constructor(private readonly share: ChatShareService) {}

  // { postId, conversationIds, userIds, note? } ⇒ { sent, failed, conversationIds }
  @Post('post')
  @UseGuards(NotRestrictedGuard)
  @HttpCode(HttpStatus.OK)
  sharePost(@Body(new ZodValidationPipe(SharePostBodySchema)) body: SharePostInput, @Req() req: Request) {
    return this.share.sharePost(requireUserId(req), body)
  }
}
