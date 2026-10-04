import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common'
import { PostsService } from './posts.service'
import { DatabaseService } from '../../database/database.service'
import type { CreatePostInput, UpdatePostInput, ReportPostInput, VotePollInput } from '@pu/schemas'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly db: DatabaseService
  ) {}

  private async resolveUserId(req: Request): Promise<string> {
    return requireUserId(req)
  }

  @Get()
  async findAll(
    @Query('tag') tag: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Query('feedType') feedType: string | undefined,
    @Req() req: Request
  ) {
    const currentUserId = (req.user as any)?.id || null
    const parsedLimit = limit ? parseInt(limit, 10) : 10
    const parsedOffset = offset ? parseInt(offset, 10) : 0
    const result = await this.postsService.findAll(
      currentUserId,
      tag,
      parsedLimit,
      parsedOffset,
      feedType || 'for_you'
    )
    return {
      success: true,
      data: result.data,
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const currentUserId = (req.user as any)?.id || null
    return this.postsService.findOne(id, currentUserId)
  }

  @Post()
  async create(@Body() body: CreatePostInput, @Req() req: Request) {
    const authorId = await this.resolveUserId(req)
    const post = await this.postsService.create(authorId, body)
    return {
      success: true,
      data: post
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePostInput,
    @Req() req: Request
  ) {
    const userId = await this.resolveUserId(req)
    const updated = await this.postsService.update(id, userId, body)
    return {
      success: true,
      data: updated
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.postsService.delete(id, userId)
  }

  @Post(':id/like')
  async toggleLike(@Param('id') id: string, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.postsService.toggleLike(id, userId)
  }

  @Post(':id/bookmark')
  async toggleBookmark(@Param('id') id: string, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.postsService.toggleBookmark(id, userId)
  }

  @Post(':id/vote-poll')
  async votePoll(
    @Param('id') id: string,
    @Body() body: VotePollInput,
    @Req() req: Request
  ) {
    const userId = await this.resolveUserId(req)
    const updatedPoll = await this.postsService.votePoll(id, userId, body.optionId)
    return {
      success: true,
      data: updatedPoll
    }
  }

  @Post(':id/pin')
  async togglePin(@Param('id') id: string, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.postsService.togglePin(id, userId)
  }

  @Post(':id/resolve')
  async toggleResolve(@Param('id') id: string, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.postsService.toggleResolve(id, userId)
  }

  @Post(':id/report')
  async report(
    @Param('id') id: string,
    @Body() body: ReportPostInput,
    @Req() req: Request
  ) {
    const userId = await this.resolveUserId(req)
    return this.postsService.report(id, userId, body)
  }
}
