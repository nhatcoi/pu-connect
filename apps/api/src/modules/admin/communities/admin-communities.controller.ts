import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin.guard'
import { AdminCommunitiesService } from './admin-communities.service'
import { AdminCommunityOwnerSchema, AdminCommunityReviewSchema, AdminCreateCommunitySchema, type AdminCreateCommunityBody } from './admin-communities.dto'

// Danh sách nằm ở GET /admin/communities (AdminController); đây là các thao tác ghi
@Controller('admin/communities')
@UseGuards(AdminGuard)
@RequireAdminPermission('academic:manage')
export class AdminCommunitiesController {
  constructor(private readonly communities: AdminCommunitiesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body(new ZodValidationPipe(AdminCreateCommunitySchema)) body: AdminCreateCommunityBody, @Req() req: Request) {
    return this.communities.create(requireUserId(req), body)
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.communities.approve(requireUserId(req), id)
    return { ok: true }
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AdminCommunityReviewSchema)) body: { note?: string }, @Req() req: Request) {
    await this.communities.reject(requireUserId(req), id, body.note)
    return { ok: true }
  }

  @Put(':id/owner')
  async owner(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AdminCommunityOwnerSchema)) body: { username: string }, @Req() req: Request) {
    await this.communities.changeOwner(requireUserId(req), id, body.username)
    return { ok: true }
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.communities.remove(requireUserId(req), id)
    return { ok: true }
  }
}
