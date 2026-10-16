import { Injectable } from '@nestjs/common'
import type { AiConnectorInfo } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { GoogleDriveService } from './google-drive.service'

// Registry connector của PU AI (menu "+" › Connectors) kèm trạng thái kết nối của người xem
@Injectable()
export class AiConnectorsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly drive: GoogleDriveService
  ) {}

  async list(userId: string): Promise<AiConnectorInfo[]> {
    const res = await this.db.query(`SELECT provider, account_email FROM user_connectors WHERE user_id = $1`, [userId])
    const linked = new Map<string, string | null>(res.rows.map((r) => [r.provider, r.account_email]))
    const internal = (id: AiConnectorInfo['id'], name: string, description: string): AiConnectorInfo => ({
      id,
      name,
      description,
      available: true,
      requiresAuth: false,
      connected: true,
      account: null
    })
    return [
      internal('library', 'Thư viện PU', 'Bài viết & tài liệu công khai, lời giải đã duyệt'),
      internal('my_documents', 'Tài liệu của tôi', 'Tài liệu bạn đã tải lên (kể cả riêng tư), đọc nội dung tệp'),
      internal('my_groups', 'Nhóm học của tôi', 'Tên, chủ đề, môn của các nhóm học bạn tham gia'),
      {
        id: 'google_drive',
        name: 'Google Drive',
        description: 'Tìm & đọc Google Docs, Sheets, Slides, PDF, Word trong Drive của bạn (chỉ đọc)',
        available: this.drive.isConfigured(),
        requiresAuth: true,
        connected: linked.has('google_drive'),
        account: linked.get('google_drive') ?? null
      }
    ]
  }
}
