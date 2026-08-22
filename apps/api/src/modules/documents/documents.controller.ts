import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common'
import { DocumentsService } from './documents.service'
import type { CreateDocumentInput } from '@pu/schemas'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(@Query('type') type?: string, @Query('search') search?: string) {
    return this.documentsService.findAll(type, search)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id)
  }

  @Post()
  async create(@Body() body: CreateDocumentInput) {
    return this.documentsService.create('user_me', body)
  }

  @Post(':id/download')
  async download(@Param('id') id: string) {
    return this.documentsService.incrementDownload(id)
  }
}
