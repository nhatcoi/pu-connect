import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import type {
  AdminBroadcastInput,
  AdminBulkCommentInput,
  AdminBulkPostInput,
  AdminBulkUserInput,
  AdminCourseInput,
  AdminModerateSkillInput,
  AdminPinPostInput,
  AdminReasonInput,
  AdminTicketStatusInput,
  AdminUpdateRoleInput,
  AdminUserNoteInput,
  AdminVerifyUserInput,
  AdminActivityType,
  SanctionInput
} from '@pu/schemas'
import {
  AdminBroadcastBodySchema,
  AdminBulkUserBodySchema,
  AdminCourseBodySchema,
  AdminModerateSkillBodySchema,
  AdminPinPostBodySchema,
  AdminReasonBodySchema,
  AdminTicketStatusBodySchema,
  AdminUpdateRoleBodySchema,
  AdminUserNoteBodySchema,
  AdminUserQuerySchema,
  ActivityQuerySchema,
  SanctionBodySchema,
  SavedViewBodySchema,
  type AdminUserQueryParsed,
  AdminVerifyUserBodySchema
} from './dto/admin.dto'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { requireUserId } from '../../common/http/current-user'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminService } from './admin.service'
import { AdminUsersService } from './admin-users.service'
import { AdminListsService } from './admin-lists.service'
import { AdminViewsService } from './admin-views.service'
import { AdminUserDataService } from './admin-user-data.service'
import {
  AuditQuerySchema,
  BulkCommentBodySchema,
  BulkPostBodySchema,
  CommentsQuerySchema,
  CommunitiesQuerySchema,
  CoursesQuerySchema,
  DocumentsQuerySchema,
  PostsQuerySchema,
  ReportsQuerySchema,
  SecurityEventsQuerySchema,
  SkillsQuerySchema,
  type AuditQuery,
  type CommentsQuery,
  type CommunitiesQuery,
  type CoursesQuery,
  type DocumentsQuery,
  type PostsQuery,
  type ReportsQuery,
  type SecurityEventsQuery,
  type SkillsQuery
} from './dto/admin-lists.dto'

const toInt = (v: string | undefined, fallback: number) => {
  const n = parseInt(v || '', 10)
  return Number.isFinite(n) ? n : fallback
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly userAdmin: AdminUsersService,
    private readonly lists: AdminListsService,
    private readonly views_: AdminViewsService,
    private readonly userData: AdminUserDataService
  ) {}

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
  reports(@Query(new ZodValidationPipe(ReportsQuerySchema)) q: ReportsQuery) {
    return this.lists.reports(q)
  }

  @Get('posts')
  @RequireAdminPermission('moderation:read')
  posts(@Query(new ZodValidationPipe(PostsQuerySchema)) q: PostsQuery) {
    return this.lists.posts(q)
  }

  // Thao tác hàng loạt trên bài viết: ẩn / hiện / ghim / bỏ ghim / bỏ qua báo cáo
  @Post('posts/bulk')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  postsBulk(@Body(new ZodValidationPipe(BulkPostBodySchema)) body: AdminBulkPostInput, @Req() req: Request) {
    return this.admin.bulkPosts(requireUserId(req), body)
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

  @Get('comment-reports')
  @RequireAdminPermission('moderation:read')
  commentReports(@Query(new ZodValidationPipe(ReportsQuerySchema)) q: ReportsQuery) {
    return this.lists.commentReports(q)
  }

  @Get('comments')
  @RequireAdminPermission('moderation:read')
  comments(@Query(new ZodValidationPipe(CommentsQuerySchema)) q: CommentsQuery) {
    return this.lists.comments(q)
  }

  @Post('comments/bulk')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  commentsBulk(@Body(new ZodValidationPipe(BulkCommentBodySchema)) body: AdminBulkCommentInput, @Req() req: Request) {
    return this.admin.bulkComments(requireUserId(req), body)
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
  // Danh sách phân trang server + lọc + sắp xếp
  @Get('users')
  @RequireAdminPermission('users:read')
  users(@Query(new ZodValidationPipe(AdminUserQuerySchema)) query: AdminUserQueryParsed) {
    return this.userAdmin.list(query)
  }

  @Get('users/summary')
  @RequireAdminPermission('users:read')
  usersSummary() {
    return this.userAdmin.summary()
  }

  // Xuất CSV theo bộ lọc (bỏ qua envelope JSON)
  @Get('users/export')
  @RequireAdminPermission('users:read')
  async usersExport(@Query(new ZodValidationPipe(AdminUserQuerySchema)) query: AdminUserQueryParsed, @Req() req: Request, @Res() res: Response) {
    const csv = await this.userAdmin.exportCsv(query)
    await this.admin.logAction(requireUserId(req), { action: 'user.export', targetType: 'system', targetId: 'users', details: { ...query } })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send(csv)
  }

  @Post('users/bulk')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('users:suspend')
  usersBulk(@Body(new ZodValidationPipe(AdminBulkUserBodySchema)) body: AdminBulkUserInput, @Req() req: Request) {
    return this.userAdmin.bulk(requireUserId(req), body)
  }

  @Get('users/:id')
  @RequireAdminPermission('users:read')
  userDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.userAdmin.detail(id)
  }

  @Post('users/:id/notes')
  @RequireAdminPermission('users:read')
  addNote(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AdminUserNoteBodySchema)) body: AdminUserNoteInput, @Req() req: Request) {
    return this.userAdmin.addNote(requireUserId(req), id, body.body)
  }

  @Delete('users/:id/notes/:noteId')
  @RequireAdminPermission('users:read')
  deleteNote(@Param('id', ParseUUIDPipe) id: string, @Param('noteId') noteId: string, @Req() req: Request) {
    if (!/^\d+$/.test(noteId)) throw new BadRequestException('noteId không hợp lệ')
    return this.userAdmin.deleteNote(requireUserId(req), id, noteId)
  }

  // Nhật ký đăng nhập, IP, thiết bị, tài khoản chung IP (ghi audit)
  @Get('users/:id/security')
  @RequireAdminPermission('users:insight')
  userSecurity(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.userAdmin.security(requireUserId(req), id)
  }

  // Dữ liệu chi tiết: bài, bình luận, cảm xúc, theo dõi, hội thoại (siêu dữ liệu), lượt xem hồ sơ…
  @Get('users/:id/activity')
  @RequireAdminPermission('users:insight')
  userActivity(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(ActivityQuerySchema)) q: { type: AdminActivityType; page: number; pageSize: number }, @Req() req: Request) {
    return this.userData.activity(requireUserId(req), id, q.type, q.page, q.pageSize)
  }

  @Get('users/:id/sessions')
  @RequireAdminPermission('users:suspend')
  userSessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.userData.sessions(id)
  }

  @Delete('users/:id/sessions/:sessionId')
  @RequireAdminPermission('users:suspend')
  revokeUserSession(@Param('id', ParseUUIDPipe) id: string, @Param('sessionId') sessionId: string, @Req() req: Request) {
    if (!/^[a-f0-9]{16}$/.test(sessionId)) throw new BadRequestException('sessionId không hợp lệ')
    return this.userData.revokeSession(requireUserId(req), id, sessionId)
  }

  // ── View đã lưu ──
  @Get('views')
  @RequireAdminPermission('dashboard:view')
  views(@Query('page') page: string, @Req() req: Request) {
    return this.views_.list(requireUserId(req), String(page || 'users').slice(0, 30))
  }

  @Post('views')
  @RequireAdminPermission('dashboard:view')
  createView(@Body(new ZodValidationPipe(SavedViewBodySchema)) body: { page: string; name: string; query: string; shared: boolean }, @Req() req: Request) {
    return this.views_.create(requireUserId(req), body)
  }

  @Delete('views/:viewId')
  @RequireAdminPermission('dashboard:view')
  deleteView(@Param('viewId') viewId: string, @Req() req: Request) {
    if (!/^\d+$/.test(viewId)) throw new BadRequestException('viewId không hợp lệ')
    return this.views_.remove(requireUserId(req), viewId)
  }

  @Post('users/:id/sanctions')
  @RequireAdminPermission('users:suspend')
  sanction(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(SanctionBodySchema)) body: SanctionInput, @Req() req: Request) {
    return this.userAdmin.sanction(requireUserId(req), id, body)
  }

  @Delete('users/:id/sanctions/:sanctionId')
  @RequireAdminPermission('users:suspend')
  revokeSanction(@Param('id', ParseUUIDPipe) id: string, @Param('sanctionId') sanctionId: string, @Req() req: Request) {
    if (!/^\d+$/.test(sanctionId)) throw new BadRequestException('sanctionId không hợp lệ')
    return this.userAdmin.revokeSanction(requireUserId(req), id, sanctionId)
  }

  @Patch('users/:id/role')
  @RequireAdminPermission('users:role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminUpdateRoleBodySchema)) body: AdminUpdateRoleInput,
    @Req() req: Request
  ) {
    return this.userAdmin.updateRole(requireUserId(req), id, body)
  }

  @Patch('users/:id/verify')
  @RequireAdminPermission('users:verify')
  verifyUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminVerifyUserBodySchema)) body: AdminVerifyUserInput,
    @Req() req: Request
  ) {
    return this.userAdmin.verify(requireUserId(req), id, body.isVerified)
  }

  @Post('users/:id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('users:suspend')
  revokeSessions(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.userAdmin.revokeSessions(requireUserId(req), id)
  }

  @Get('users/:id/insight')
  @RequireAdminPermission('users:insight')
  userInsight(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.userAdmin.userInsight(requireUserId(req), id)
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('users:suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AdminReasonBodySchema)) body: AdminReasonInput, @Req() req: Request) {
    return this.userAdmin.suspend(requireUserId(req), id, body.reason)
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('users:suspend')
  unsuspend(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.userAdmin.unsuspend(requireUserId(req), id)
  }

  // ── 4. N7AI Operations & Telemetry ──
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
  aiSkills(@Query(new ZodValidationPipe(SkillsQuerySchema)) q: SkillsQuery) {
    return this.lists.skills(q)
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
  courses(@Query(new ZodValidationPipe(CoursesQuerySchema)) q: CoursesQuery) {
    return this.lists.courses(q)
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
  documents(@Query(new ZodValidationPipe(DocumentsQuerySchema)) q: DocumentsQuery) {
    return this.lists.documents(q)
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
  communities(@Query(new ZodValidationPipe(CommunitiesQuerySchema)) q: CommunitiesQuery) {
    return this.lists.communities(q)
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
  auditLogs(@Query(new ZodValidationPipe(AuditQuerySchema)) q: AuditQuery) {
    return this.lists.audit(q)
  }

  // Nhật ký đăng nhập toàn hệ thống (IP / thiết bị)
  @Get('security-events')
  @RequireAdminPermission('users:insight')
  securityEvents(@Query(new ZodValidationPipe(SecurityEventsQuerySchema)) q: SecurityEventsQuery) {
    return this.lists.securityEvents(q)
  }
}
