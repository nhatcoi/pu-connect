import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminAiProviderInput, AdminAiProviderPatch } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AdminAiProvidersService } from './admin-ai-providers.service'
import { AiProviderCreateBodySchema, AiProviderMoveBodySchema, AiProviderPatchBodySchema } from './dto/admin-ai-providers.dto'

@Controller('admin/ai/providers')
@UseGuards(AdminGuard)
export class AdminAiProvidersController {
  constructor(private readonly providers: AdminAiProvidersService) {}

  @Get()
  @RequireAdminPermission('ai:read')
  list() {
    return this.providers.list()
  }

  @Post()
  @RequireAdminPermission('ai:manage')
  create(@Body(new ZodValidationPipe(AiProviderCreateBodySchema)) body: AdminAiProviderInput, @Req() req: Request) {
    return this.providers.create(requireUserId(req), body)
  }

  @Post('import-env')
  @HttpCode(200)
  @RequireAdminPermission('ai:manage')
  importFromEnv(@Req() req: Request) {
    return this.providers.importFromEnv(requireUserId(req))
  }

  @Patch(':id')
  @RequireAdminPermission('ai:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiProviderPatchBodySchema)) body: AdminAiProviderPatch, @Req() req: Request) {
    return this.providers.update(requireUserId(req), id, body)
  }

  @Delete(':id')
  @RequireAdminPermission('ai:manage')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.providers.remove(requireUserId(req), id)
  }

  @Post(':id/move')
  @HttpCode(200)
  @RequireAdminPermission('ai:manage')
  move(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AiProviderMoveBodySchema)) body: { direction: 'up' | 'down' }, @Req() req: Request) {
    return this.providers.move(requireUserId(req), id, body.direction)
  }

  // Thử kết nối: gọi ra ngoài bằng key đã lưu ⇒ cần quyền quản lý như các thao tác ghi
  @Post(':id/test')
  @HttpCode(200)
  @RequireAdminPermission('ai:manage')
  test(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.test(id)
  }
}
