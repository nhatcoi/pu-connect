import { Injectable } from '@nestjs/common'
import type { AiConnectorInfo } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { GoogleOAuthService, type GoogleProvider } from './google-oauth.service'

type Static = Pick<AiConnectorInfo, 'id' | 'name' | 'description'>

const INTERNAL: Static[] = [
  { id: 'library', name: 'Thư viện PU', description: 'Bài viết & tài liệu công khai, lời giải đã duyệt' },
  { id: 'my_documents', name: 'Tài liệu của tôi', description: 'Tài liệu bạn đã tải lên (kể cả riêng tư), đọc nội dung tệp' },
  { id: 'my_groups', name: 'Nhóm học của tôi', description: 'Tên, chủ đề, môn của các nhóm học bạn tham gia' }
]
const GOOGLE: (Static & { id: GoogleProvider })[] = [
  { id: 'google_drive', name: 'Google Drive', description: 'Tìm & đọc Docs, Sheets, Slides, PDF, Word trong Drive (chỉ đọc)' },
  { id: 'google_calendar', name: 'Google Calendar', description: 'Lịch sắp tới để lập lộ trình ôn, hỏi lịch bận (chỉ đọc)' }
]

// Registry connector của PU AI (menu "+" › Connectors) kèm trạng thái kết nối của người xem
@Injectable()
export class AiConnectorsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly oauth: GoogleOAuthService
  ) {}

  async list(userId: string): Promise<AiConnectorInfo[]> {
    const res = await this.db.query(`SELECT provider, account_email FROM user_connectors WHERE user_id = $1`, [userId])
    const linked = new Map<string, string | null>(res.rows.map((r) => [r.provider, r.account_email]))
    const available = this.oauth.isConfigured()
    return [
      ...INTERNAL.map((c) => ({ ...c, available: true, requiresAuth: false, connected: true, account: null })),
      ...GOOGLE.map((c) => ({ ...c, available, requiresAuth: true, connected: linked.has(c.id), account: linked.get(c.id) ?? null }))
    ]
  }
}
