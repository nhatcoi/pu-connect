import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  Req,
  Query
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import { StorageService } from './storage.service'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import type { Request } from 'express'
import 'multer'
import { requireUserId } from '../../common/http/current-user'

type UploadFolder = 'posts/images' | 'documents' | 'avatars' | 'banners'

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
  // Nén: tên MIME khác nhau theo trình duyệt/hệ điều hành
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed'
]
// Chỉ cho phép thư mục + loại tệp đã biết (chặn HTML/SVG/JS được host công khai trên R2)
const ALLOWED_TYPES: Record<UploadFolder, string[]> = {
  'posts/images': IMAGE_TYPES,
  avatars: IMAGE_TYPES,
  banners: IMAGE_TYPES,
  documents: DOCUMENT_TYPES
}

function validateUpload(folder: string | undefined, files: Express.Multer.File[]): UploadFolder {
  const target = (folder || 'posts/images') as UploadFolder
  const allowed = ALLOWED_TYPES[target]
  if (!allowed) throw new BadRequestException('Thư mục tải lên không hợp lệ')
  const bad = files.find((f) => !allowed.includes(f.mimetype))
  if (bad) throw new BadRequestException(`Định dạng tệp không được hỗ trợ: ${bad.originalname}`)
  return target
}

// Upload yêu cầu đăng nhập (guard chạy trước khi multer đọc file)
@Controller('upload')
@UseGuards(AuthenticatedGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadSingleFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: 'posts/images' | 'documents' | 'avatars' | 'banners',
    @Req() req?: Request
  ) {
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
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder?: 'posts/images' | 'documents' | 'avatars' | 'banners',
    @Req() req?: Request
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một tệp để tải lên')
    }

    const userId = requireUserId(req as Request)
    const target = validateUpload(folder, files)
    const uploadPromises = files.map((file) =>
      this.storageService.uploadFile(file.buffer, file.originalname, file.mimetype, target, userId)
    )

    const results = await Promise.all(uploadPromises)

    return {
      success: true,
      data: results
    }
  }
}
