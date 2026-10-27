import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin.guard'
import { AdminCoursesService } from './admin-courses.service'
import { CourseImportSchema, CourseLecturersSchema, CourseMergeSchema, LecturerSearchSchema, type CourseImport } from './admin-courses.dto'

// Phần mở rộng của admin/courses (danh sách, tạo, sửa nằm ở AdminController)
@Controller('admin/courses')
@UseGuards(AdminGuard)
export class AdminCoursesController {
  constructor(private readonly courses: AdminCoursesService) {}

  @Get('lecturer-candidates')
  @RequireAdminPermission('academic:read')
  candidates(@Query(new ZodValidationPipe(LecturerSearchSchema)) q: { q?: string }) {
    return this.courses.candidates(q.q)
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('academic:manage')
  import(@Body(new ZodValidationPipe(CourseImportSchema)) body: CourseImport, @Req() req: Request) {
    return this.courses.importRows(requireUserId(req), body)
  }

  @Get(':id/lecturers')
  @RequireAdminPermission('academic:read')
  lecturers(@Param('id', ParseUUIDPipe) id: string) {
    return this.courses.lecturers(id)
  }

  @Put(':id/lecturers')
  @RequireAdminPermission('academic:manage')
  setLecturers(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CourseLecturersSchema)) body: { userIds: string[] }, @Req() req: Request) {
    return this.courses.setLecturers(requireUserId(req), id, body.userIds)
  }

  @Post(':id/merge')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('academic:manage')
  merge(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CourseMergeSchema)) body: { intoId: string }, @Req() req: Request) {
    return this.courses.merge(requireUserId(req), id, body.intoId)
  }

  @Delete(':id')
  @RequireAdminPermission('academic:manage')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.courses.remove(requireUserId(req), id)
  }
}
