import { Injectable } from '@nestjs/common'
import type { AiConnectorInfo } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { GoogleOAuthService, type GoogleProvider } from './google-oauth.service'
import { WebReaderService } from './web-reader.service'

type Static = Pick<AiConnectorInfo, 'id' | 'name' | 'description'>

const INTERNAL: Static[] = [
  { id: 'library', name: 'Thư viện PU', description: 'Bài viết & tài liệu công khai, lời giải đã duyệt' },
  { id: 'my_documents', name: 'Tài liệu của tôi', description: 'Tài liệu bạn đã tải lên (kể cả riêng tư), đọc nội dung tệp' },
  { id: 'my_groups', name: 'Nhóm học của tôi', description: 'Tên, chủ đề, môn của các nhóm học bạn tham gia' },
  { id: 'web', name: 'Đọc trang web', description: 'Đọc nội dung link bạn dán vào câu hỏi (chỉ trang công khai)' }
]
const GOOGLE: (Static & { id: GoogleProvider })[] = [
  { id: 'google_drive', name: 'Google Drive', description: 'Tìm & đọc Docs, Sheets, Slides, PDF, Word trong Drive (chỉ đọc)' },
  { id: 'google_calendar', name: 'Google Calendar', description: 'Lịch sắp tới để lập lộ trình ôn, hỏi lịch bận (chỉ đọc)' }
]

// Registry connector của N7AI (menu "+" › Connectors) kèm trạng thái kết nối của người xem
@Injectable()
export class AiConnectorsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly oauth: GoogleOAuthService,
    private readonly web: WebReaderService
  ) {}

  async list(userId: string): Promise<AiConnectorInfo[]> {
    const res = await this.db.query(`SELECT provider, account_email, last_used_at, last_error FROM user_connectors WHERE user_id = $1`, [userId])
    const linked = new Map<string, { account_email: string | null; last_used_at: Date | null; last_error: string | null }>(res.rows.map((r) => [r.provider, r]))
    const available = this.oauth.isConfigured()
    const internal = (c: Static, ok = true): AiConnectorInfo => ({
      ...c,
      available: ok,
      requiresAuth: false,
      connected: true,
      account: null,
      lastUsedAt: null,
      lastError: null
    })
    return [
      ...INTERNAL.map((c) => internal(c)),
      internal({ id: 'web_search', name: 'Tìm kiếm web', description: 'Tìm trên Internet khi thư viện PU chưa đủ (Research)' }, this.web.canSearch()),
      ...GOOGLE.map((c) => {
        const row = linked.get(c.id)
        return {
          ...c,
          available,
          requiresAuth: true,
          connected: !!row,
          account: row?.account_email ?? null,
          lastUsedAt: row?.last_used_at ? new Date(row.last_used_at).toISOString() : null,
          lastError: row?.last_error ?? null
        }
      })
    ]
  }
}
