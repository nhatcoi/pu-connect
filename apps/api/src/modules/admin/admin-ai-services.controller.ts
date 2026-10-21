import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import type { AiServiceType } from '@pu/schemas'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from './admin.guard'
import { AiServicesConfigService } from '../ai/ai-services-config.service'
import { AiServicePatchDto, AiServicePatchSchema } from './dto/admin-ai-services.dto'

@Controller('admin/ai/services')
@UseGuards(AdminGuard)
export class AdminAiServicesController {
  constructor(private readonly aiServices: AiServicesConfigService) {}

  @Get()
  @RequireAdminPermission('ai:read')
  list() {
    return this.aiServices.list()
  }

  @Patch(':service')
  @RequireAdminPermission('ai:manage')
  update(
    @Param('service') service: AiServiceType,
    @Body(new ZodValidationPipe(AiServicePatchSchema)) body: AiServicePatchDto,
    @Req() req: Request
  ) {
    requireUserId(req)
    return this.aiServices.update(service, body)
  }

  @Post(':service/test')
  @RequireAdminPermission('ai:manage')
  test(@Param('service') service: AiServiceType, @Req() req: Request) {
    requireUserId(req)
    return this.aiServices.test(service)
  }
}
