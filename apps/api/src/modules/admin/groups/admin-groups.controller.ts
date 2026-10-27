import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin.guard'
import { AdminGroupsService } from './admin-groups.service'
import { GroupBodySchema, GroupMembersSchema, MemberSearchSchema, type GroupBody } from './admin-groups.dto'

@Controller('admin/groups')
@UseGuards(AdminGuard)
@RequireAdminPermission('roles:manage')
export class AdminGroupsController {
  constructor(private readonly groups: AdminGroupsService) {}

  @Get()
  list() {
    return this.groups.list()
  }

  @Get('member-candidates')
  candidates(@Query(new ZodValidationPipe(MemberSearchSchema)) q: { q?: string }) {
    return this.groups.candidates(q.q)
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body(new ZodValidationPipe(GroupBodySchema)) body: GroupBody, @Req() req: Request) {
    return this.groups.create(requireUserId(req), body)
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(GroupBodySchema)) body: GroupBody, @Req() req: Request) {
    return this.groups.update(requireUserId(req), id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.groups.remove(requireUserId(req), id)
  }

  @Get(':id/members')
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.groups.members(id)
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMembers(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(GroupMembersSchema)) body: { userIds: string[] }, @Req() req: Request) {
    return this.groups.addMembers(requireUserId(req), id, body.userIds)
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.groups.removeMember(requireUserId(req), id, userId)
  }
}
