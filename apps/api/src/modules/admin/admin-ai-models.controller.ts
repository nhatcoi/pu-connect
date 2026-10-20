import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminAiModelInput, AdminAiModelPatch } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminAiModelsService } from './admin-ai-models.service'
import { AiModelBulkBodySchema, AiModelCreateBodySchema, AiModelPatchBodySchema } from './dto/admin-ai-models.dto'

@Controller('admin/ai/models')
@UseGuards(AdminGuard)
export class AdminAiModelsController {
  constructor(private readonly models: AdminAiModelsService) {}

  @Get()
  @RequireAdminPermission('ai:read')
  list() {
    return this.models.list()
  }

  @Post()
  @RequireAdminPermission('ai:manage')
  create(@Body(new ZodValidationPipe(AiModelCreateBodySchema)) body: AdminAiModelInput, @Req() req: Request) {
    return this.models.create(requireUserId(req), body)
  }

  // Thêm nhiều model một lần (chọn từ danh sách provider báo về)
  @Post('bulk')
  @HttpCode(200)
  @RequireAdminPermission('ai:manage')
  bulk(@Body(new ZodValidationPipe(AiModelBulkBodySchema)) body: { items: AdminAiModelInput[] }, @Req() req: Request) {
    return this.models.createMany(requireUserId(req), body.items)
  }

  @Patch(':id')
  @RequireAdminPermission('ai:manage')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(AiModelPatchBodySchema)) body: AdminAiModelPatch, @Req() req: Request) {
    return this.models.update(requireUserId(req), id, body)
  }

  @Delete(':id')
  @RequireAdminPermission('ai:manage')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.models.remove(requireUserId(req), id)
  }
}
