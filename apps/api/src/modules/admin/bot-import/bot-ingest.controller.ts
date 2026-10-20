import { Controller, HttpCode, HttpStatus, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import 'multer'
import { BotImageUploadService } from './bot-image-upload.service'
import { BotIngestGuard } from './bot-ingest.guard'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

// Tool crawl (máy cá nhân) chỉ xin URL ảnh bền cho file Excel — không đụng bot, không dùng phiên admin, chỉ token chung
@Controller('bots/ingest')
@UseGuards(BotIngestGuard)
export class BotIngestController {
  constructor(private readonly images: BotImageUploadService) {}

  @Post('images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('images', MAX_IMAGES, { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadImages(@UploadedFiles() files: Express.Multer.File[] = []) {
    return this.images.upload(files.filter((f) => IMAGE_TYPES.includes(f.mimetype)))
  }
}
