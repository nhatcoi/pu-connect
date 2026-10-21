import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
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

  // Cập nhật model qua body (hỗ trợ an toàn 100% cho mọi mã model có ký tự đặc biệt '/')
  @Patch()
  @RequireAdminPermission('ai:manage')
  updateRoot(@Body(new ZodValidationPipe(AiModelPatchBodySchema)) body: AdminAiModelPatch & { currentId?: string }, @Req() req: Request) {
    const targetId = body.currentId || body.id
    if (!targetId) throw new BadRequestException('Thiếu mã model cần cập nhật')
    return this.models.update(requireUserId(req), targetId, body)
  }

  @Patch(':id(*)')
  @RequireAdminPermission('ai:manage')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(AiModelPatchBodySchema)) body: AdminAiModelPatch & { currentId?: string }, @Req() req: Request) {
    const targetId = body.currentId || id
    return this.models.update(requireUserId(req), targetId, body)
  }

  // Xóa model qua query string (?id=...)
  @Delete()
  @RequireAdminPermission('ai:manage')
  removeRoot(@Query('id') queryId: string, @Req() req: Request) {
    if (!queryId) throw new BadRequestException('Thiếu mã model cần xóa')
    return this.models.remove(requireUserId(req), queryId)
  }

  @Delete(':id(*)')
  @RequireAdminPermission('ai:manage')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.models.remove(requireUserId(req), id)
  }
}
