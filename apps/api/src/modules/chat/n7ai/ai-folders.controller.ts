import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AiFolderInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import { AiFolderBodySchema } from '../dto/chat.dto'
import { AiFoldersService } from './ai-folders.service'

// Thư mục lịch sử N7AI (chuyển thread: PATCH /ai/threads/:id/folder)
@Controller('ai/folders')
@UseGuards(AuthenticatedGuard)
export class AiFoldersController {
  constructor(private readonly folders: AiFoldersService) {}

  @Get()
  list(@Req() req: Request) {
    return this.folders.list(requireUserId(req))
  }

  @Post()
  create(@Body(new ZodValidationPipe(AiFolderBodySchema)) body: AiFolderInput, @Req() req: Request) {
    return this.folders.create(requireUserId(req), body.name)
  }

  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiFolderBodySchema)) body: AiFolderInput, @Req() req: Request) {
    return this.folders.rename(requireUserId(req), id, body.name)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.folders.remove(requireUserId(req), id)
  }
}
