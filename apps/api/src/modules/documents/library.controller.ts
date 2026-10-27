import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import 'multer'
import { NotRestrictedGuard } from '../../common/guards/not-restricted.guard'
import { requireUserId } from '../../common/http/current-user'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { validateUpload } from '../storage/storage.controller'
import {
  type LibraryFolderBody,
  LibraryFolderSchema,
  type MoveLibraryItemBody,
  MoveLibraryItemSchema,
  type SaveToLibraryBody,
  SaveToLibrarySchema
} from './dto/documents.dto'
import { LibraryService } from './library.service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Kho cá nhân: chỉ chủ kho đọc / sửa (mọi route cần đăng nhập)
@Controller('library')
@UseGuards(AuthenticatedGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  async list(@Req() req: Request, @Query('scope') scope?: string, @Query('folder') folder?: string, @Query('q') q?: string, @Query('cursor') cursor?: string) {
    return this.library.list(requireUserId(req), { scope: scope === 'mine' ? 'mine' : 'saved', folder, q: q?.slice(0, 100), cursor })
  }

  @Get('ids')
  async ids(@Req() req: Request) {
    return this.library.savedIds(requireUserId(req))
  }

  @Post()
  async save(@Body(new ZodValidationPipe(SaveToLibrarySchema)) body: SaveToLibraryBody, @Req() req: Request) {
    return this.library.save(requireUserId(req), body.documentId, body.folderId)
  }

  // Tệp riêng tải thẳng vào kho (riêng tư, không vào kho môn học)
  @Post('upload')
  @UseGuards(NotRestrictedGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req: Request, @Query('folder') folder?: string) {
    if (!file) throw new BadRequestException('Vui lòng chọn tệp để tải lên')
    validateUpload('documents', [file])
    if (file.mimetype.startsWith('image/')) throw new BadRequestException('Kho tài liệu chưa nhận ảnh')
    return this.library.upload(requireUserId(req), file, folder && UUID_RE.test(folder) ? folder : null)
  }

  @Get('folders')
  async folders(@Req() req: Request) {
    return this.library.folders(requireUserId(req))
  }

  @Post('folders')
  async createFolder(@Body(new ZodValidationPipe(LibraryFolderSchema)) body: LibraryFolderBody, @Req() req: Request) {
    return this.library.createFolder(requireUserId(req), body.name)
  }

  @Patch('folders/:id')
  async renameFolder(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(LibraryFolderSchema)) body: LibraryFolderBody, @Req() req: Request) {
    return this.library.renameFolder(requireUserId(req), id, body.name)
  }

  @Delete('folders/:id')
  async deleteFolder(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.library.deleteFolder(requireUserId(req), id)
  }

  @Patch(':documentId')
  async move(@Param('documentId', ParseUUIDPipe) documentId: string, @Body(new ZodValidationPipe(MoveLibraryItemSchema)) body: MoveLibraryItemBody, @Req() req: Request) {
    return this.library.move(requireUserId(req), documentId, body.folderId)
  }

  @Delete(':documentId')
  async remove(@Param('documentId', ParseUUIDPipe) documentId: string, @Req() req: Request) {
    return this.library.remove(requireUserId(req), documentId)
  }
}
