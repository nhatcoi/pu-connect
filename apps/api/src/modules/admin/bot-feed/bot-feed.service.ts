import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../database/database.service'
import { StorageService } from '../../storage/storage.service'
import { filterFeedContent } from './feed-content-filter'

export type IngestResult = { status: 'queued' | 'duplicate' | 'rejected'; reason?: string }
export type IngestImage = { buffer: Buffer; mimetype: string; originalname: string }

// Nhận bài crawl, lọc, chống trùng, lưu ảnh lên R2 rồi xếp hàng cho daemon đăng
@Injectable()
export class BotFeedService {
  private readonly logger = new Logger(BotFeedService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService
  ) {}

  async ingest(input: { key: string; content: string }, images: IngestImage[]): Promise<IngestResult> {
    const filtered = filterFeedContent(input.content)
    if ('reason' in filtered) return { status: 'rejected', reason: filtered.reason }

    // Kiểm tra trùng trước khi tải ảnh để khỏi tốn R2
    const dup = await this.db.query(`SELECT 1 FROM bot_feed_items WHERE source_key = $1 OR content_hash = $2`, [input.key, filtered.hash])
    if (dup.rowCount) return { status: 'duplicate' }

    const imageUrls: string[] = []
    for (const img of images) {
      try {
        imageUrls.push((await this.storage.uploadFile(img.buffer, img.originalname, img.mimetype, 'posts/images')).url)
      } catch (err: any) {
        this.logger.warn(`Bỏ ảnh (upload lỗi): ${err?.message}`)
      }
    }

    // UNIQUE ở DB chặn race giữa 2 request cùng lúc
    const res = await this.db.query(
      `INSERT INTO bot_feed_items (source_key, content_hash, content, image_urls) VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING RETURNING id`,
      [input.key, filtered.hash, filtered.content, imageUrls]
    )
    return res.rowCount ? { status: 'queued' } : { status: 'duplicate' }
  }
}
