import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminUnitInput, AdminUnitPatch, AdminUnitRequestApprove, UnitKind, UnitRequestStatus } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminUnitsService } from './admin-units.service'
import {
  UnitCreateBodySchema,
  UnitKindParamSchema,
  UnitMergeBodySchema,
  UnitPatchBodySchema,
  UnitRequestApproveBodySchema,
  UnitRequestRejectBodySchema,
  UnitRequestStatusSchema
} from './dto/admin-units.dto'

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminUnitsController {
  constructor(private readonly units: AdminUnitsService) {}

  @Get('units')
  @RequireAdminPermission('academic:read')
  list() {
    return this.units.list()
  }

  @Post('units')
  @RequireAdminPermission('academic:manage')
  create(@Body(new ZodValidationPipe(UnitCreateBodySchema)) body: AdminUnitInput, @Req() req: Request) {
    return this.units.create(requireUserId(req), body)
  }

  @Patch('units/:kind/:id')
  @RequireAdminPermission('academic:manage')
  update(
    @Param('kind', new ZodValidationPipe(UnitKindParamSchema)) kind: UnitKind,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UnitPatchBodySchema)) body: AdminUnitPatch,
    @Req() req: Request
  ) {
    return this.units.update(requireUserId(req), kind, id, body)
  }

  @Post('units/:kind/:id/merge')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('academic:manage')
  merge(
    @Param('kind', new ZodValidationPipe(UnitKindParamSchema)) kind: UnitKind,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UnitMergeBodySchema)) body: { targetId: string },
    @Req() req: Request
  ) {
    return this.units.merge(requireUserId(req), kind, id, body.targetId)
  }

  @Delete('units/:kind/:id')
  @RequireAdminPermission('academic:manage')
  remove(@Param('kind', new ZodValidationPipe(UnitKindParamSchema)) kind: UnitKind, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.units.remove(requireUserId(req), kind, id)
  }

  @Get('unit-requests')
  @RequireAdminPermission('academic:read')
  listRequests(@Query('status', new ZodValidationPipe(UnitRequestStatusSchema)) status: UnitRequestStatus) {
    return this.units.listRequests(status)
  }

  @Post('unit-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('academic:manage')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UnitRequestApproveBodySchema)) body: AdminUnitRequestApprove, @Req() req: Request) {
    return this.units.approveRequest(requireUserId(req), id, body)
  }

  @Post('unit-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('academic:manage')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UnitRequestRejectBodySchema)) body: { reason?: string }, @Req() req: Request) {
    return this.units.rejectRequest(requireUserId(req), id, body.reason)
  }
}
