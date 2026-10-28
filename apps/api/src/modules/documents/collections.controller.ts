import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { optionalUserId, requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { CollectionsService } from './collections.service'
import { type CollectionBody, CollectionBodySchema, CollectionListQuerySchema, CollectionMembershipQuerySchema } from './dto/documents.dto'

// Bộ sưu tập tài liệu: xem công khai, sửa chỉ chủ bộ
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(CollectionListQuerySchema)) query: { scope: 'mine' | 'public'; cursor?: string }, @Req() req: Request) {
    return this.collections.list(optionalUserId(req), query.scope, query.cursor)
  }

  // Khai báo trước ':id'
  @Get('membership')
  @UseGuards(AuthenticatedGuard)
  membership(@Query(new ZodValidationPipe(CollectionMembershipQuerySchema)) query: { documentId: string }, @Req() req: Request) {
    return this.collections.membership(requireUserId(req), query.documentId)
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.collections.detail(id, optionalUserId(req))
  }

  @Post()
  @UseGuards(AuthenticatedGuard)
  create(@Body(new ZodValidationPipe(CollectionBodySchema)) body: CollectionBody, @Req() req: Request) {
    return this.collections.create(requireUserId(req), body)
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CollectionBodySchema)) body: CollectionBody, @Req() req: Request) {
    return this.collections.update(id, requireUserId(req), body)
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.collections.remove(id, requireUserId(req))
  }

  @Put(':id/documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  add(@Param('id', ParseUUIDPipe) id: string, @Param('documentId', ParseUUIDPipe) documentId: string, @Req() req: Request) {
    return this.collections.addDocument(id, requireUserId(req), documentId)
  }

  @Delete(':id/documents/:documentId')
  @UseGuards(AuthenticatedGuard)
  removeDocument(@Param('id', ParseUUIDPipe) id: string, @Param('documentId', ParseUUIDPipe) documentId: string, @Req() req: Request) {
    return this.collections.removeDocument(id, requireUserId(req), documentId)
  }
}
