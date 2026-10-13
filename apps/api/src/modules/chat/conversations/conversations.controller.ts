import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { CreateGroupChatInput, MemberSettingsInput, UpdateGroupInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../../common/http/current-user'
import { AuthenticatedGuard } from '../../auth/guards/authenticated.guard'
import {
  AddMembersBodySchema,
  CreateGroupChatBodySchema,
  MarkReadBodySchema,
  MemberSettingsBodySchema,
  OpenDirectBodySchema,
  TransferOwnerBodySchema,
  UpdateGroupBodySchema
} from '../dto/chat.dto'
import { ConversationsService } from './conversations.service'
import { StudyGroupChatService } from './study-group-chat.service'

// Hội thoại & thành viên (socket chỉ đẩy sự kiện xuống)
@Controller('conversations')
@UseGuards(AuthenticatedGuard)
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly studyGroupChat: StudyGroupChatService
  ) {}

  @Get()
  list(@Req() req: Request) {
    return this.conversations.list(requireUserId(req))
  }

  @Get('unread-count')
  async unread(@Req() req: Request) {
    return { total: await this.conversations.unreadTotal(requireUserId(req)) }
  }

  @Post('direct')
  @HttpCode(HttpStatus.OK)
  openDirect(@Body(new ZodValidationPipe(OpenDirectBodySchema)) body: { userId: string }, @Req() req: Request) {
    return this.conversations.openDirect(requireUserId(req), body.userId)
  }

  @Post('ai')
  @HttpCode(HttpStatus.OK)
  openAi(@Req() req: Request) {
    return this.conversations.openAi(requireUserId(req))
  }

  // Nhóm chat của nhóm học (tạo lười, chỉ thành viên nhóm học)
  @Post('study-groups/:groupId')
  @HttpCode(HttpStatus.OK)
  openStudyGroup(@Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: Request) {
    return this.studyGroupChat.open(requireUserId(req), groupId)
  }

  @Post()
  createGroup(@Body(new ZodValidationPipe(CreateGroupChatBodySchema)) body: CreateGroupChatInput, @Req() req: Request) {
    return this.conversations.createGroup(requireUserId(req), body)
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.conversations.get(requireUserId(req), id)
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateGroupBodySchema)) body: UpdateGroupInput, @Req() req: Request) {
    return this.conversations.updateGroup(requireUserId(req), id, body)
  }

  // Cài đặt riêng: tắt thông báo, ghim hội thoại
  @Patch(':id/settings')
  settings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MemberSettingsBodySchema)) body: MemberSettingsInput,
    @Req() req: Request
  ) {
    return this.conversations.updateSettings(requireUserId(req), id, body)
  }

  @Get(':id/members')
  members(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.conversations.listMembers(requireUserId(req), id)
  }

  @Post(':id/members')
  addMembers(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AddMembersBodySchema)) body: { userIds: string[] }, @Req() req: Request) {
    return this.conversations.addMembers(requireUserId(req), id, body.userIds)
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.conversations.removeMember(requireUserId(req), id, userId)
  }

  // Chuyển quyền trưởng nhóm
  @Post(':id/owner')
  @HttpCode(HttpStatus.OK)
  transferOwner(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(TransferOwnerBodySchema)) body: { userId: string }, @Req() req: Request) {
    return this.conversations.transferOwnership(requireUserId(req), id, body.userId)
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  read(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(MarkReadBodySchema)) body: { messageId: string }, @Req() req: Request) {
    return this.conversations.markRead(requireUserId(req), id, body.messageId)
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  leave(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.conversations.leave(requireUserId(req), id)
  }
}
