import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import 'multer'
import type { ClassifyDocumentInput, WriteDocumentPostInput } from '@pu/schemas'
import { NotRestrictedGuard } from '../../common/guards/not-restricted.guard'
import { optionalUserId, requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { validateUpload } from '../storage/storage.controller'
import { DocumentAiService } from './document-ai.service'
import { DocumentsService } from './documents.service'
import {
  type BrowseDocumentsQuery,
  BrowseDocumentsSchema,
  ClassifyDocumentSchema,
  type CreateDocumentBody,
  CreateDocumentBodySchema,
  CoursePathQuerySchema,
  type RateDocumentBody,
  RateDocumentSchema,
  type SuggestFileBody,
  SuggestFileSchema,
  type DocumentStudyDraftBody,
  DocumentStudyDraftSchema,
  WriteDocumentPostSchema
} from './dto/documents.dto'

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentAi: DocumentAiService
  ) {}

  @Get()
  async findAll(@Query('type') type?: string, @Query('search') search?: string, @Query('course') course?: string) {
    return this.documentsService.findAll(type, search, course)
  }

  // Trang "Tài liệu": kho chung có lọc + phân trang
  @Get('browse')
  async browse(@Query(new ZodValidationPipe(BrowseDocumentsSchema)) query: BrowseDocumentsQuery) {
    return this.documentsService.browse(query)
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

  // "Viết giúp": N7AI viết nội dung bài từ các tài liệu đang đính kèm (1 lượt N7AI)
  @Post('write-post')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  async writePost(@Body(new ZodValidationPipe(WriteDocumentPostSchema)) body: WriteDocumentPostInput, @Req() req: Request) {
    return this.documentAi.writePost(requireUserId(req), body)
  }

  // Lộ trình học của môn: tài liệu theo thứ tự ôn + đề thi theo năm học — khai báo trước ':id'
  @Get('course-path')
  async coursePath(@Query(new ZodValidationPipe(CoursePathQuerySchema)) query: { course: string }) {
    return this.documentsService.coursePath(query.course)
  }

  // Chấm sao tài liệu (đổi được) / bỏ chấm
  @Put(':id/rating')
  @UseGuards(AuthenticatedGuard)
  async rate(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(RateDocumentSchema)) body: RateDocumentBody, @Req() req: Request) {
    return this.documentsService.rate(id, requireUserId(req), body.rating)
  }

  @Delete(':id/rating')
  @UseGuards(AuthenticatedGuard)
  async unrate(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documentsService.unrate(id, requireUserId(req))
  }

  @Get(':id/detail')
  async detail(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documentsService.detail(id, optionalUserId(req))
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

  // N7AI gợi ý cho tệp vừa tải lên R2, chưa thành tài liệu (hộp Chia sẻ tài liệu; 1 lượt N7AI)
  @Post('suggest-file')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  async suggestFile(@Body(new ZodValidationPipe(SuggestFileSchema)) body: SuggestFileBody, @Req() req: Request) {
    return this.documentAi.suggestFile(requireUserId(req), body)
  }

  // N7AI gợi ý môn / loại / năm học / tiêu đề từ nội dung tệp (chủ tài liệu, 1 lượt N7AI)
  @Post(':id/suggest')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  async suggest(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documentAi.suggest(id, requireUserId(req))
  }

  // "Học với N7AI": tóm tắt tài liệu (1 lượt N7AI)
  @Post(':id/summarize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  async summarize(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documentAi.summarize(id, requireUserId(req))
  }

  // "Học với N7AI": bản nháp bộ Flashcard / Quiz từ nội dung tài liệu (chưa lưu, 1 lượt N7AI)
  @Post(':id/study-draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  async studyDraft(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(DocumentStudyDraftSchema)) body: DocumentStudyDraftBody, @Req() req: Request) {
    return this.documentAi.studyDraft(id, requireUserId(req), body.kind)
  }

  // Chủ tài liệu xóa tài liệu đã đăng (gỡ khỏi bài, bình luận, kho của mọi người)
  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documentsService.remove(id, requireUserId(req))
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
