import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common'
import { NotRestrictedGuard } from '../../common/guards/not-restricted.guard'
import type { Request } from 'express'
import { requireUserId } from '../../common/http/current-user'
import { DocumentsService } from './documents.service'
import type { CreateDocumentInput } from '@pu/schemas'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(@Query('type') type?: string, @Query('search') search?: string, @Query('course') course?: string) {
    return this.documentsService.findAll(type, search, course)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id)
  }

  @Post()
  @UseGuards(NotRestrictedGuard)
  async create(@Body() body: CreateDocumentInput, @Req() req: Request) {
    return this.documentsService.create(requireUserId(req), body)
  }

  @Post(':id/download')
  async download(@Param('id') id: string) {
    return this.documentsService.incrementDownload(id)
  }
}
