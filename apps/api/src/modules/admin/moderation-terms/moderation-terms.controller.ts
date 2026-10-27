import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { requireUserId } from '../../../common/http/current-user'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { AdminGuard, RequireAdminPermission } from '../admin.guard'
import { ModerationTermsService } from './moderation-terms.service'
import { TermBodySchema, TermImportSchema, TermListSchema, type TermBody, type TermImport } from './moderation-terms.dto'

@Controller('admin/moderation-terms')
@UseGuards(AdminGuard)
export class ModerationTermsController {
  constructor(private readonly terms: ModerationTermsService) {}

  @Get()
  @RequireAdminPermission('moderation:read')
  list(@Query(new ZodValidationPipe(TermListSchema)) q: { q?: string }) {
    return this.terms.list(q.q)
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  create(@Body(new ZodValidationPipe(TermBodySchema)) body: TermBody, @Req() req: Request) {
    return this.terms.create(requireUserId(req), body)
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission('moderation:write')
  import(@Body(new ZodValidationPipe(TermImportSchema)) body: TermImport, @Req() req: Request) {
    return this.terms.importTerms(requireUserId(req), body)
  }

  @Put(':id')
  @RequireAdminPermission('moderation:write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(TermBodySchema)) body: TermBody, @Req() req: Request) {
    return this.terms.update(requireUserId(req), id, body)
  }

  @Delete(':id')
  @RequireAdminPermission('moderation:write')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.terms.remove(requireUserId(req), id)
  }
}
