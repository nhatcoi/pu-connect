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

@Controller('upload')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadSingleFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: 'posts/images' | 'documents' | 'avatars',
    @Req() req?: Request
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp để tải lên')
    }

    const userId = (req?.user as any)?.id || 'anonymous'
    const result = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder || 'posts/images',
      userId
    )

    return {
      success: true,
      data: result
    }
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder?: 'posts/images' | 'documents' | 'avatars',
    @Req() req?: Request
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một tệp để tải lên')
    }

    const userId = (req?.user as any)?.id || 'anonymous'
    const uploadPromises = files.map((file) =>
      this.storageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        folder || 'posts/images',
        userId
      )
    )

    const results = await Promise.all(uploadPromises)

    return {
      success: true,
      data: results
    }
  }
}
