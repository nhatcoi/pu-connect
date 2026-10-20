import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminAcademicUnitInput, AdminAcademicUnitPatch } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminUnitsService } from './admin-units.service'
import { UnitCreateBodySchema, UnitMergeBodySchema, UnitPatchBodySchema, UnitReorderBodySchema } from './dto/admin-units.dto'

@Controller('admin/academic-units')
@UseGuards(AdminGuard)
export class AdminUnitsController {
  constructor(private readonly units: AdminUnitsService) {}

  @Get()
  @RequireAdminPermission('academic:read')
  list() {
    return this.units.list()
  }

  @Post()
  @RequireAdminPermission('academic:manage')
  create(@Body(new ZodValidationPipe(UnitCreateBodySchema)) body: AdminAcademicUnitInput, @Req() req: Request) {
    return this.units.create(requireUserId(req), body)
  }

  @Patch(':id')
  @RequireAdminPermission('academic:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UnitPatchBodySchema)) body: AdminAcademicUnitPatch, @Req() req: Request) {
    return this.units.update(requireUserId(req), id, body)
  }

  @Post(':id/reorder')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('academic:manage')
  reorder(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UnitReorderBodySchema)) body: { direction: 'up' | 'down' }, @Req() req: Request) {
    return this.units.reorder(requireUserId(req), id, body.direction)
  }

  @Post(':id/merge')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('academic:manage')
  merge(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UnitMergeBodySchema)) body: { targetId: string }, @Req() req: Request) {
    return this.units.merge(requireUserId(req), id, body.targetId)
  }

  @Delete(':id')
  @RequireAdminPermission('academic:manage')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.units.remove(requireUserId(req), id)
  }
}
