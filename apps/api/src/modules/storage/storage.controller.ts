import { Controller, Get, Post, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, NotFoundException, UseGuards, Req, Res, Query } from '@nestjs/common'
import { NotRestrictedGuard } from '../../common/guards/not-restricted.guard'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import { StorageService, type UploadFolder } from './storage.service'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import type { Request, Response } from 'express'
import 'multer'
import { requireUserId } from '../../common/http/current-user'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const DOCUMENT_TYPES = [
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/csv',
  // Nén: tên MIME khác nhau theo trình duyệt/hệ điều hành
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed'
]
// Mã nguồn / dữ liệu văn bản: trình duyệt thường gửi MIME rỗng hoặc riêng từng loại ⇒ nhận theo đuôi, lưu thành text/plain
const TEXT_EXTENSIONS = new Set([
  'py', 'java', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'ts', 'tsx', 'js', 'jsx',
  'json', 'xml', 'yml', 'yaml', 'tex', 'log', 'tsv', 'ipynb', 'r', 'm', 'kt', 'swift'
])
const TEXT_MIME = /^(text\/|application\/(json|xml|x-yaml|octet-stream)$|$)/
const READABLE_KEY = /^(chat|documents)\/[\w.\-/]+$/

const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase()

// Chỉ cho phép thư mục + loại tệp đã biết (chặn HTML/SVG/JS được host công khai trên R2)
const ALLOWED_TYPES: Record<UploadFolder, string[]> = {
  'posts/images': IMAGE_TYPES,
  avatars: IMAGE_TYPES,
  banners: IMAGE_TYPES,
  documents: DOCUMENT_TYPES,
  chat: DOCUMENT_TYPES // tệp đính kèm tin nhắn
}

function validateUpload(folder: string | undefined, files: Express.Multer.File[]): UploadFolder {
  const target = (folder || 'posts/images') as UploadFolder
  const allowed = ALLOWED_TYPES[target]
  if (!allowed) throw new BadRequestException('Thư mục tải lên không hợp lệ')
  const isText = (f: Express.Multer.File) => TEXT_EXTENSIONS.has(extOf(f.originalname)) && TEXT_MIME.test(f.mimetype)
  const bad = files.find((f) => !allowed.includes(f.mimetype) && !(target === 'chat' && isText(f)))
  if (bad) throw new BadRequestException(`Định dạng tệp không được hỗ trợ: ${bad.originalname}`)
  // Tệp văn bản nhận theo đuôi ⇒ ép text/plain (không bao giờ được host như HTML/JS)
  for (const f of files) if (!allowed.includes(f.mimetype)) f.mimetype = 'text/plain'
  return target
}

// Upload yêu cầu đăng nhập (guard chạy trước khi multer đọc file)
@Controller('upload')
@UseGuards(AuthenticatedGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  // Trình xem tệp trong app đọc byte qua đây (R2 public không có CORS). Chỉ thư mục chat/documents; luôn trả octet-stream + nosniff
  @Get('read')
  async read(@Query('key') key: string | undefined, @Res() res: Response) {
    if (!key || key.includes('..') || !READABLE_KEY.test(key)) throw new BadRequestException('Tệp không hợp lệ')
    const object = await this.storageService.readObject(key)
    if (!object) throw new NotFoundException('Không tìm thấy tệp')
    res.set({
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
      ...(object.size ? { 'Content-Length': String(object.size) } : {})
    })
    object.body.pipe(res)
  }

  @Post('file')
  @UseGuards(NotRestrictedGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadSingleFile(@UploadedFile() file: Express.Multer.File, @Query('folder') folder?: UploadFolder, @Req() req?: Request) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp để tải lên')
    }

    const userId = requireUserId(req as Request)
    const target = validateUpload(folder, [file])
    const result = await this.storageService.uploadFile(file.buffer, file.originalname, file.mimetype, target, userId)

    return {
      success: true,
      data: result
    }
  }

  @Post('multiple')
  @UseGuards(NotRestrictedGuard)
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[], @Query('folder') folder?: UploadFolder, @Req() req?: Request) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một tệp để tải lên')
    }

    const userId = requireUserId(req as Request)
    const target = validateUpload(folder, files)
    const uploadPromises = files.map((file) => this.storageService.uploadFile(file.buffer, file.originalname, file.mimetype, target, userId))

    const results = await Promise.all(uploadPromises)

    return {
      success: true,
      data: results
    }
  }
}
