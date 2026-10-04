import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UnauthorizedException
} from '@nestjs/common'
import { CommunitiesService } from './communities.service'
import { DatabaseService } from '../../database/database.service'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly db: DatabaseService
  ) {}

  private async resolveUserId(req: Request): Promise<string> {
    return requireUserId(req)
  }

  @Get()
  async findAll(
    @Query('type') type: string | undefined,
    @Query('search') search: string | undefined,
    @Req() req: Request
  ) {
    const currentUserId = (req.user as any)?.id || null
    const data = await this.communitiesService.findAll(type, search, currentUserId)
    return {
      success: true,
      data
    }
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const currentUserId = (req.user as any)?.id || null
    const data = await this.communitiesService.findBySlug(slug, currentUserId)
    return {
      success: true,
      data
    }
  }

  @Post(':slug/join')
  async toggleJoin(@Param('slug') slug: string, @Req() req: Request) {
    const userId = await this.resolveUserId(req)
    return this.communitiesService.toggleJoin(slug, userId)
  }

  @Get(':slug/posts')
  async getCommunityPosts(
    @Param('slug') slug: string,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Query('sort') sort: 'hot' | 'new' | 'top' | undefined,
    @Req() req: Request
  ) {
    const currentUserId = (req.user as any)?.id || null
    const parsedLimit = limit ? parseInt(limit, 10) : 10
    const parsedOffset = offset ? parseInt(offset, 10) : 0
    const result = await this.communitiesService.getCommunityPosts(
      slug,
      currentUserId,
      parsedLimit,
      parsedOffset,
      sort || 'hot'
    )
    return {
      success: true,
      data: result.posts,
      community: result.community,
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset
    }
  }
}
