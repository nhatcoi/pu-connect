import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common'
import { CommunitiesService } from './communities.service'
import { DatabaseService } from '../../database/database.service'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CommunityManagementService } from './community-management.service'
import {
  CreateCommunityBodySchema,
  HidePostBodySchema,
  MemberRoleBodySchema,
  MembersQuerySchema,
  UpdateCommunityBodySchema,
  type CreateCommunityBody,
  type MembersQuery,
  type UpdateCommunityBody
} from './communities.dto'

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly management: CommunityManagementService,
    private readonly db: DatabaseService
  ) {}

  private async resolveUserId(req: Request): Promise<string> {
    return requireUserId(req)
  }

  @Get()
  async findAll(@Query('type') type: string | undefined, @Query('search') search: string | undefined, @Req() req: Request) {
    const currentUserId = (req.user as any)?.id || null
    const data = await this.communitiesService.findAll(type, search, currentUserId)
    return {
      success: true,
      data
    }
  }

  // Người dùng đủ điều kiện tạo cộng đồng ⇒ chờ admin duyệt
  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body(new ZodValidationPipe(CreateCommunityBodySchema)) body: CreateCommunityBody, @Req() req: Request) {
    return { success: true, data: await this.management.create(await this.resolveUserId(req), body) }
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
    const result = await this.communitiesService.getCommunityPosts(slug, currentUserId, parsedLimit, parsedOffset, sort || 'hot')
    return {
      success: true,
      data: result.posts,
      community: result.community,
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset
    }
  }

  // ── Quản trị cộng đồng (chủ / điều hành viên) ──
  @Patch(':slug')
  async update(@Param('slug') slug: string, @Body(new ZodValidationPipe(UpdateCommunityBodySchema)) body: UpdateCommunityBody, @Req() req: Request) {
    return { success: true, data: await this.management.update(slug, await this.resolveUserId(req), body) }
  }

  @Get(':slug/members')
  async members(@Param('slug') slug: string, @Query(new ZodValidationPipe(MembersQuerySchema)) q: MembersQuery, @Req() req: Request) {
    return { success: true, data: await this.management.members(slug, await this.resolveUserId(req), q) }
  }

  @Put(':slug/members/:userId/role')
  async setRole(
    @Param('slug') slug: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
    @Body(new ZodValidationPipe(MemberRoleBodySchema)) body: { role: 'moderator' | 'member' },
    @Req() req: Request
  ) {
    return { success: true, data: await this.management.setRole(slug, await this.resolveUserId(req), targetId, body.role) }
  }

  @Delete(':slug/members/:userId')
  async removeMember(@Param('slug') slug: string, @Param('userId', ParseUUIDPipe) targetId: string, @Req() req: Request) {
    return { success: true, data: await this.management.removeMember(slug, await this.resolveUserId(req), targetId) }
  }

  @Get(':slug/hidden-posts')
  async hiddenPosts(@Param('slug') slug: string, @Req() req: Request) {
    return { success: true, data: await this.management.hiddenPosts(slug, await this.resolveUserId(req)) }
  }

  @Post(':slug/posts/:postId/hide')
  @HttpCode(HttpStatus.OK)
  async hidePost(
    @Param('slug') slug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body(new ZodValidationPipe(HidePostBodySchema)) body: { reason?: string },
    @Req() req: Request
  ) {
    return { success: true, data: await this.management.hidePost(slug, await this.resolveUserId(req), postId, body.reason) }
  }

  @Delete(':slug/posts/:postId/hide')
  async unhidePost(@Param('slug') slug: string, @Param('postId', ParseUUIDPipe) postId: string, @Req() req: Request) {
    return { success: true, data: await this.management.unhidePost(slug, await this.resolveUserId(req), postId) }
  }
}
