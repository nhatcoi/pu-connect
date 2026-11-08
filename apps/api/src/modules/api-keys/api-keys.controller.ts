import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { z } from 'zod'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { API_KEY_SCOPES } from './api-key.scopes'
import { ApiKeysService } from './api-keys.service'

const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, { message: 'Đặt tên cho key' }).max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
  expiresInDays: z.number().int().min(1).max(365).nullish()
})
type CreateApiKeyBody = z.infer<typeof CreateApiKeySchema>

// Quản lý key chỉ qua phiên đăng nhập (middleware chặn key gọi lại /api-keys)
@Controller('api-keys')
@UseGuards(AuthenticatedGuard)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@Req() req: Request) {
    return this.keys.list(requireUserId(req))
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateApiKeySchema)) body: CreateApiKeyBody, @Req() req: Request) {
    return this.keys.create(requireUserId(req), body as { name: string; scopes: string[]; expiresInDays?: number | null })
  }

  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.keys.revoke(requireUserId(req), id)
  }
}
