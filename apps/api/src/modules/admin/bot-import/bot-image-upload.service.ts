import { Injectable, Logger } from '@nestjs/common'
import { StorageService } from '../../storage/storage.service'

export type UploadImage = { buffer: Buffer; mimetype: string; originalname: string }

// Tool crawl xuất Excel: tải ảnh lên R2 lấy URL bền (URL ảnh Facebook hết hạn), file Excel ghi URL này
@Injectable()
export class BotImageUploadService {
  private readonly logger = new Logger(BotImageUploadService.name)

  constructor(private readonly storage: StorageService) {}

  async upload(images: UploadImage[]): Promise<{ urls: string[] }> {
    const urls: string[] = []
    for (const img of images) {
      try {
        urls.push((await this.storage.uploadFile(img.buffer, img.originalname, img.mimetype, 'posts/images')).url)
      } catch (err: any) {
        this.logger.warn(`Bỏ ảnh (upload lỗi): ${err?.message}`)
      }
    }
    return { urls }
  }
}
