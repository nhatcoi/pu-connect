import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common'
import { CommunitiesService } from './communities.service'
import { DatabaseService } from '../../database/database.service'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CommunityManagementService } from './community-management.service'
import { CommunityExtrasService } from './community-extras.service'
import { CommunityChatService } from '../chat/conversations/community-chat.service'
import {
  AddCommunityDocumentBodySchema,
  CommunityAskBodySchema,
  CommunityNotifyBodySchema,
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
    private readonly extras: CommunityExtrasService,
    private readonly chat: CommunityChatService,
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

  // ── Bài ghim ──
  @Get(':slug/pins')
  async pins(@Param('slug') slug: string, @Req() req: Request) {
    return { success: true, data: await this.extras.pins(slug, (req.user as any)?.id || null) }
  }

  @Put(':slug/pins/:postId')
  async pin(@Param('slug') slug: string, @Param('postId', ParseUUIDPipe) postId: string, @Req() req: Request) {
    return { success: true, data: await this.extras.pin(slug, await this.resolveUserId(req), postId) }
  }

  @Delete(':slug/pins/:postId')
  async unpin(@Param('slug') slug: string, @Param('postId', ParseUUIDPipe) postId: string, @Req() req: Request) {
    return { success: true, data: await this.extras.unpin(slug, await this.resolveUserId(req), postId) }
  }

  // ── Tài liệu của cộng đồng ──
  @Get(':slug/documents')
  async documents(@Param('slug') slug: string, @Req() req: Request) {
    return { success: true, data: await this.extras.documents(slug, (req.user as any)?.id || null) }
  }

  @Get(':slug/documents/candidates')
  async documentCandidates(@Param('slug') slug: string, @Req() req: Request) {
    return { success: true, data: await this.extras.documentCandidates(slug, await this.resolveUserId(req)) }
  }

  @Post(':slug/documents')
  @HttpCode(HttpStatus.OK)
  async addDocument(@Param('slug') slug: string, @Body(new ZodValidationPipe(AddCommunityDocumentBodySchema)) body: { documentId: string }, @Req() req: Request) {
    return { success: true, data: await this.extras.addDocument(slug, await this.resolveUserId(req), body.documentId) }
  }

  @Delete(':slug/documents/:documentId')
  async removeDocument(@Param('slug') slug: string, @Param('documentId', ParseUUIDPipe) documentId: string, @Req() req: Request) {
    return { success: true, data: await this.extras.removeDocument(slug, await this.resolveUserId(req), documentId) }
  }

  // ── Thông báo bài mới ──
  @Get(':slug/notify')
  async notifyState(@Param('slug') slug: string, @Req() req: Request) {
    return { success: true, data: await this.extras.notifyState(slug, await this.resolveUserId(req)) }
  }

  @Put(':slug/notify')
  async setNotify(@Param('slug') slug: string, @Body(new ZodValidationPipe(CommunityNotifyBodySchema)) body: { enabled: boolean }, @Req() req: Request) {
    return { success: true, data: await this.extras.setNotify(slug, await this.resolveUserId(req), body.enabled) }
  }

  // ── Hỏi N7AI theo nội dung cộng đồng ──
  @Post(':slug/ask')
  @HttpCode(HttpStatus.OK)
  async ask(@Param('slug') slug: string, @Body(new ZodValidationPipe(CommunityAskBodySchema)) body: { question: string }, @Req() req: Request) {
    return { success: true, data: await this.extras.ask(slug, await this.resolveUserId(req), body.question) }
  }

  // ── Nhóm chat của cộng đồng ──
  @Post(':slug/chat')
  @HttpCode(HttpStatus.OK)
  async openChat(@Param('slug') slug: string, @Req() req: Request) {
    return { success: true, data: await this.chat.open(await this.resolveUserId(req), slug) }
  }
}
