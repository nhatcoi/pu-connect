import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common'
import { PostsService } from './posts.service'
import { PostAiService } from './post-ai.service'
import { DatabaseService } from '../../database/database.service'
import type { CreatePostInput, UpdatePostInput, ReportPostInput, VotePollInput, UserProfile } from '@pu/schemas'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postAi: PostAiService,
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
    @Query('course') course: string | undefined,
    @Query('before') before: string | undefined,
    @Query('after') after: string | undefined,
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
      feedType || 'for_you',
      course,
      // Người xem tắt "Bình luận nổi bật" ⇒ bỏ query (req.user nạp từ session mỗi request)
      { before, after, featuredComment: (req.user as UserProfile | undefined)?.preferences?.featuredComment }
    )
    return {
      success: true,
      data: result.data,
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      snapshotAt: result.snapshotAt
    }
  }

  // Pill "bài mới": số bài mới hơn `since` + ≤ 3 tác giả (đặt trước :id)
  @Get('new-since')
  async newSince(
    @Query('since') since: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('feedType') feedType: string | undefined,
    @Query('course') course: string | undefined,
    @Req() req: Request
  ) {
    const currentUserId = (req.user as any)?.id || undefined
    return this.postsService.countNewSince(currentUserId, { since, tag, feedType, courseCode: course })
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
  async update(@Param('id') id: string, @Body() body: UpdatePostInput, @Req() req: Request) {
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
  async votePoll(@Param('id') id: string, @Body() body: VotePollInput, @Req() req: Request) {
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

  // Tóm tắt bài bằng N7AI (bản đã lưu không tốn lượt)
  @Post(':id/summary')
  @HttpCode(HttpStatus.OK)
  summarize(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.postAi.summarize(id, requireUserId(req, 'Đăng nhập để dùng N7AI'))
  }

  @Post(':id/report')
  async report(@Param('id') id: string, @Body() body: ReportPostInput, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.postsService.report(id, userId, body)
  }
}
