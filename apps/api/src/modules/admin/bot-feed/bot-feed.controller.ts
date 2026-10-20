import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { z } from 'zod'
import 'multer'
import { BotIngestGuard } from './bot-ingest.guard'
import { BotFeedService } from './bot-feed.service'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const IngestBodySchema = z.object({ key: z.string().trim().min(1).max(200), content: z.string().min(1).max(20_000) })

// Tool crawl (máy cá nhân) đẩy bài vào hàng đợi bot — không dùng phiên admin, chỉ token chung
@Controller('bots/ingest')
@UseGuards(BotIngestGuard)
export class BotFeedController {
  constructor(private readonly feed: BotFeedService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('images', MAX_IMAGES, { limits: { fileSize: MAX_IMAGE_BYTES } }))
  ingest(@Body() body: unknown, @UploadedFiles() files: Express.Multer.File[] = []) {
    const parsed = IngestBodySchema.safeParse(body)
    if (!parsed.success) throw new BadRequestException('key/content không hợp lệ')
    const images = files.filter((f) => IMAGE_TYPES.includes(f.mimetype))
    return this.feed.ingest({ key: parsed.data.key, content: parsed.data.content }, images)
  }
}
