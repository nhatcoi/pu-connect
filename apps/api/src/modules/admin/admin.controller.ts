import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type {
  AdminBroadcastInput,
  AdminCourseInput,
  AdminModerateSkillInput,
  AdminPinPostInput,
  AdminReasonInput,
  AdminTicketStatusInput,
  AdminUpdateRoleInput,
  AdminVerifyUserInput
} from '@pu/schemas'
import {
  AdminBroadcastBodySchema,
  AdminCourseBodySchema,
  AdminModerateSkillBodySchema,
  AdminPinPostBodySchema,
  AdminReasonBodySchema,
  AdminTicketStatusBodySchema,
  AdminUpdateRoleBodySchema,
  AdminVerifyUserBodySchema
} from './dto/admin.dto'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../common/http/current-user'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminService } from './admin.service'

const toInt = (v: string | undefined, fallback: number) => {
  const n = parseInt(v || '', 10)
  return Number.isFinite(n) ? n : fallback
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // Thông tin phiên quản trị & danh sách quyền RBAC hiện tại
  @Get('me')
  @RequireAdminPermission('dashboard:view')
  me(@Req() req: Request) {
    return this.admin.getSessionInfo(requireUserId(req))
  }

  // ── 1. Command Center Dashboard ──
  @Get('stats')
  @RequireAdminPermission('dashboard:view')
  stats() {
    return this.admin.getStats()
  }

  // ── 2. Trust & Safety / Content Moderation ──
  @Get('reports')
  @RequireAdminPermission('moderation:read')
  reports(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.admin.listReports(status === 'resolved' ? 'resolved' : 'pending', toInt(limit, 50))
  }

  @Get('posts')
  @RequireAdminPermission('moderation:read')
  posts(@Query('q') q?: string, @Query('filter') filter?: string, @Query('limit') limit?: string) {
    return this.admin.listPosts(q, filter, toInt(limit, 50))
  }

  @Post('posts/:id/hide')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  hidePost(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AdminReasonBodySchema)) body: AdminReasonInput, @Req() req: Request) {
    return this.admin.hidePost(requireUserId(req), id, body.reason)
  }

  @Post('posts/:id/unhide')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  unhidePost(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.unhidePost(requireUserId(req), id)
  }

  @Post('posts/:id/pin')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  pinPost(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AdminPinPostBodySchema)) body: AdminPinPostInput, @Req() req: Request) {
    return this.admin.pinPost(requireUserId(req), id, body.isPinned)
  }

  @Post('posts/:id/dismiss-reports')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  dismissReports(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.dismissReports(requireUserId(req), id)
  }

  @Get('comments')
  @RequireAdminPermission('moderation:read')
  comments(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.admin.listComments(q, toInt(limit, 50))
  }

  @Delete('comments/:id')
  @RequireAdminPermission('moderation:write')
  deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminReasonBodySchema)) body: AdminReasonInput,
    @Req() req: Request
  ) {
    return this.admin.deleteComment(requireUserId(req), id, body?.reason)
  }

  // ── 3. Users, Identity & RBAC ──
  @Get('users')
  @RequireAdminPermission('users:read')
  users(@Query('q') q?: string, @Query('status') status?: string, @Query('role') role?: string, @Query('limit') limit?: string) {
    return this.admin.listUsers(q, status, role, toInt(limit, 50))
  }

  @Patch('users/:id/role')
  @RequireAdminPermission('users:role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminUpdateRoleBodySchema)) body: AdminUpdateRoleInput,
    @Req() req: Request
  ) {
    return this.admin.updateUserRole(requireUserId(req), id, body)
  }

  @Patch('users/:id/verify')
  @RequireAdminPermission('users:verify')
  verifyUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminVerifyUserBodySchema)) body: AdminVerifyUserInput,
    @Req() req: Request
  ) {
    return this.admin.verifyUser(requireUserId(req), id, body.isVerified)
  }

  @Post('users/:id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('users:suspend')
  revokeSessions(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.revokeUserSessions(requireUserId(req), id)
  }

  @Get('users/:id/insight')
  @RequireAdminPermission('users:insight')
  userInsight(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.userInsight(requireUserId(req), id)
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('users:suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AdminReasonBodySchema)) body: AdminReasonInput, @Req() req: Request) {
    return this.admin.suspendUser(requireUserId(req), id, body.reason)
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('users:suspend')
  unsuspend(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.unsuspendUser(requireUserId(req), id)
  }

  // ── 4. PU AI Operations & Telemetry ──
  @Get('ai/overview')
  @RequireAdminPermission('ai:read')
  aiOverview() {
    return this.admin.getAiOverview()
  }

  @Patch('ai/tickets/:id')
  @RequireAdminPermission('ai:manage')
  updateTicketStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminTicketStatusBodySchema)) body: AdminTicketStatusInput,
    @Req() req: Request
  ) {
    return this.admin.updateTicketStatus(requireUserId(req), id, body)
  }

  @Get('ai/skills')
  @RequireAdminPermission('ai:read')
  aiSkills(@Query('publicOnly') publicOnly?: string, @Query('limit') limit?: string) {
    return this.admin.listAiSkills(publicOnly === 'true', toInt(limit, 50))
  }

  @Patch('ai/skills/:id')
  @RequireAdminPermission('ai:manage')
  moderateSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminModerateSkillBodySchema)) body: AdminModerateSkillInput,
    @Req() req: Request
  ) {
    return this.admin.moderateSkill(requireUserId(req), id, body)
  }

  // ── 5. Academic, Documents & Communities ──
  @Get('courses')
  @RequireAdminPermission('academic:read')
  courses(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.admin.listCourses(q, toInt(limit, 50))
  }

  @Post('courses')
  @RequireAdminPermission('academic:manage')
  createCourse(@Body(new ZodValidationPipe(AdminCourseBodySchema)) body: AdminCourseInput, @Req() req: Request) {
    return this.admin.createCourse(requireUserId(req), body)
  }

  @Patch('courses/:id')
  @RequireAdminPermission('academic:manage')
  updateCourse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminCourseBodySchema)) body: AdminCourseInput,
    @Req() req: Request
  ) {
    return this.admin.updateCourse(requireUserId(req), id, body)
  }

  @Get('documents')
  @RequireAdminPermission('academic:read')
  documents(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.admin.listDocuments(q, toInt(limit, 50))
  }

  @Delete('documents/:id')
  @RequireAdminPermission('academic:manage')
  deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminReasonBodySchema)) body: AdminReasonInput,
    @Req() req: Request
  ) {
    return this.admin.deleteDocument(requireUserId(req), id, body?.reason)
  }

  @Get('communities')
  @RequireAdminPermission('academic:read')
  communities(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.admin.listCommunities(q, toInt(limit, 50))
  }

  // ── 6. Search Intelligence, Broadcast & Audit Trail ──
  @Get('search/zero-results')
  @RequireAdminPermission('search:read')
  zeroResults(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.admin.zeroResultQueries(toInt(days, 30), toInt(limit, 50))
  }

  @Get('search/top')
  @RequireAdminPermission('search:read')
  topSearches(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.admin.topSearchQueries(toInt(days, 30), toInt(limit, 50))
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('system:broadcast')
  broadcast(@Body(new ZodValidationPipe(AdminBroadcastBodySchema)) body: AdminBroadcastInput, @Req() req: Request) {
    return this.admin.broadcastSystemNotification(requireUserId(req), body)
  }

  @Get('audit-logs')
  @RequireAdminPermission('audit:read')
  auditLogs(@Query('limit') limit?: string, @Query('action') action?: string) {
    return this.admin.listAuditLogs(toInt(limit, 100), action)
  }
}
