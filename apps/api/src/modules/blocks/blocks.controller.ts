import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Put, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { BlocksService } from './blocks.service'

// Danh sách chặn của chính mình (PUT/DELETE idempotent)
@Controller('blocks')
@UseGuards(AuthenticatedGuard)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  list(@Req() req: Request) {
    return this.blocks.list(requireUserId(req))
  }

  @Put(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  block(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.blocks.block(requireUserId(req), userId)
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblock(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.blocks.unblock(requireUserId(req), userId)
  }
}
