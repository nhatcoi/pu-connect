import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common'
import { PostsService } from './posts.service'
import { DatabaseService } from '../../database/database.service'
import type { CreatePostInput } from '@pu/schemas'
import type { Request } from 'express'

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly db: DatabaseService
  ) {}

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
    let authorId = (req.user as any)?.id

    // If not in session, fallback to first active user in database for dev
    if (!authorId) {
      const fallbackUser = await this.db.query(
        `SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`
      )
      if (fallbackUser.rows.length > 0) {
        authorId = fallbackUser.rows[0].id
      } else {
        throw new UnauthorizedException('Vui lòng đăng nhập để đăng bài viết')
      }
    }

    const post = await this.postsService.create(authorId, body)
    return {
      success: true,
      data: post
    }
  }

  @Post(':id/like')
  async toggleLike(@Param('id') id: string, @Req() req: Request) {
    let userId = (req.user as any)?.id
    if (!userId) {
      const fallbackUser = await this.db.query(
        `SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`
      )
      userId = fallbackUser.rows[0]?.id
    }
    if (!userId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để thích bài viết')
    }

    return this.postsService.toggleLike(id, userId)
  }

  @Post(':id/bookmark')
  async toggleBookmark(@Param('id') id: string, @Req() req: Request) {
    let userId = (req.user as any)?.id
    if (!userId) {
      const fallbackUser = await this.db.query(
        `SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`
      )
      userId = fallbackUser.rows[0]?.id
    }
    if (!userId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để lưu bài viết')
    }

    return this.postsService.toggleBookmark(id, userId)
  }
}
