import { Injectable } from '@nestjs/common'
import { bufferToText, isExtractableMime } from '../doc-text'
import type { ConnectorSource } from './connector-source'
import { GoogleOAuthService } from './google-oauth.service'

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_CHARS_PER_FILE = 2500

// File Google (Docs/Sheets/Slides) ⇒ xuất văn bản
const EXPORT_MIME: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain'
}

type DriveFile = { id: string; name: string; mimeType: string; size?: string }

// Hư từ / từ đệm hay gặp trong câu hỏi tiếng Việt ⇒ không dùng làm từ khóa tìm file
const STOPWORDS = new Set(
  'giúp mình bạn tôi cho của là gì thế nào này kia với và các những được một hãy làm sao không có về thích ơi nhé nha giùm em anh chị trong'.split(' ')
)

// Từ khóa giữ dấu (Drive fullText tự xử lý), bỏ hư từ, ưu tiên từ dài
function keywords(question: string): string[] {
  const words = Array.from(new Set(question.toLowerCase().split(/[^\p{L}\p{N}]+/u))).filter((w) => w.length >= 2 && !STOPWORDS.has(w))
  return words.sort((a, b) => b.length - a.length).slice(0, 4)
}

// Connector Google Drive (drive.readonly): tìm fullText rồi đọc nội dung vài file liên quan
@Injectable()
export class GoogleDriveService {
  constructor(private readonly oauth: GoogleOAuthService) {}

  async search(userId: string, question: string, limit: number): Promise<ConnectorSource[]> {
    const words = keywords(question)
    if (!words.length) return []
    const token = await this.oauth.accessToken(userId, 'google_drive')
    if (!token) return []
    const q = `trashed = false and (${words.map((w) => `fullText contains '${w.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(' or ')})`
    const params = new URLSearchParams({ q, pageSize: String(limit), fields: 'files(id,name,mimeType,size)', spaces: 'drive' })
    const files = ((await (await this.oauth.get(`${DRIVE_API}?${params}`, token)).json()) as { files?: DriveFile[] }).files ?? []
    const read = await Promise.all(files.map((f) => this.readFile(f, token).catch(() => null)))
    return read.filter((s): s is ConnectorSource => !!s?.body)
  }

  private async readFile(f: DriveFile, token: string): Promise<ConnectorSource | null> {
    let text: string
    const exportMime = EXPORT_MIME[f.mimeType]
    if (exportMime) {
      text = await (await this.oauth.get(`${DRIVE_API}/${f.id}/export?mimeType=${encodeURIComponent(exportMime)}`, token)).text()
    } else if (isExtractableMime(f.mimeType) && Number(f.size ?? 0) <= MAX_FILE_BYTES) {
      const buf = Buffer.from(await (await this.oauth.get(`${DRIVE_API}/${f.id}?alt=media`, token)).arrayBuffer())
      text = await bufferToText(buf, f.mimeType)
    } else {
      return null
    }
    return { id: f.id, title: f.name, body: text.slice(0, MAX_CHARS_PER_FILE).trim() }
  }
}
