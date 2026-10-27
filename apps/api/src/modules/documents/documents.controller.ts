import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import 'multer'
import type { ClassifyDocumentInput } from '@pu/schemas'
import { NotRestrictedGuard } from '../../common/guards/not-restricted.guard'
import { optionalUserId, requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { validateUpload } from '../storage/storage.controller'
import { DocumentsService } from './documents.service'
import { ClassifyDocumentSchema, type CreateDocumentBody, CreateDocumentBodySchema } from './dto/documents.dto'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(@Query('type') type?: string, @Query('search') search?: string, @Query('course') course?: string) {
    return this.documentsService.findAll(type, search, course)
  }

  // Đính kèm khi soạn bài: tải tệp + tạo bản nháp (guard chạy trước khi multer đọc tệp)
  @Post('upload')
  @UseGuards(AuthenticatedGuard, NotRestrictedGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp để tải lên')
    validateUpload('documents', [file])
    if (file.mimetype.startsWith('image/')) throw new BadRequestException('Ảnh đính kèm dùng mục ảnh của bài viết')
    return this.documentsService.upload(requireUserId(req), file)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.documentsService.findOne(id, optionalUserId(req))
  }

  @Post()
  @UseGuards(NotRestrictedGuard)
  async create(@Body(new ZodValidationPipe(CreateDocumentBodySchema)) body: CreateDocumentBody, @Req() req: Request) {
    return this.documentsService.create(requireUserId(req), body)
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  async classify(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ClassifyDocumentSchema)) body: ClassifyDocumentInput, @Req() req: Request) {
    return this.documentsService.classify(id, requireUserId(req), body)
  }

  @Delete(':id/draft')
  @UseGuards(AuthenticatedGuard)
  async discardDraft(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documentsService.discardDraft(id, requireUserId(req))
  }

  @Post(':id/download')
  @HttpCode(HttpStatus.OK)
  async download(@Param('id') id: string) {
    return this.documentsService.incrementDownload(id)
  }
}
