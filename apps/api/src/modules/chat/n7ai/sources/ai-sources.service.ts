import { BadGatewayException, BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { AiSource, AiSourceInput, AiSourceMeta, AiSourcePatch, ChatAttachment } from '@pu/schemas'
import { DatabaseService } from '../../../../database/database.service'
import { WebReaderService } from '../../../ai/connectors/web-reader.service'
import { isExtractableMime } from '../../../ai/doc-text'
import { StorageService } from '../../../storage/storage.service'
import { AI_SOURCE_TEXT_MAX } from '../../dto/chat.dto'
import { type SourceText } from './source-context'
import { fetchYoutubeTranscript, youtubeId, YoutubeTranscriptError } from './youtube-transcript'

const THREAD_LIMIT = 30 // tài liệu / cuộc trò chuyện
const LIBRARY_LIMIT = 100 // tài liệu / thư viện
const COLUMNS = `id, thread_id, kind, title, url, file_key, mime, size, created_at, meta, in_context, LENGTH(content) AS chars`

type SourceFile = { key: string; name: string; size: number; mime: string }

const isImage = (mime: string) => mime.startsWith('image/')
// Tệp làm tài liệu học: N7AI phải đọc được (PDF, Word, PowerPoint, Excel, văn bản, mã nguồn) hoặc là ảnh
const isLearnable = (mime: string) => isExtractableMime(mime) || isImage(mime)

const toAttachment = (r: any): ChatAttachment => ({ url: r.url, key: r.file_key, name: r.title, size: r.size, mime: r.mime, kind: isImage(r.mime) ? 'image' : 'file' })

const mapSource = (r: any): AiSource => ({
  id: r.id,
  threadId: r.thread_id,
  kind: r.kind,
  title: r.title,
  url: r.kind === 'file' ? null : r.url,
  attachment: r.kind === 'file' ? toAttachment(r) : null,
  chars: r.chars ?? null,
  meta: r.meta ?? null,
  inContext: r.in_context,
  createdAt: new Date(r.created_at).toISOString()
})

// Tài liệu của cuộc trò chuyện N7AI (hoặc thư viện khi thread_id NULL): tệp, văn bản dán, trang web, YouTube
// N7AI đọc các tài liệu này ở mọi lượt trả lời trong thread (xem context())
@Injectable()
export class AiSourcesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly web: WebReaderService
  ) {}

  async list(userId: string, threadId?: string): Promise<AiSource[]> {
    if (threadId) await this.assertThread(userId, threadId)
    const res = await this.db.query(
      `SELECT ${COLUMNS} FROM ai_sources WHERE user_id = $1 AND thread_id IS NOT DISTINCT FROM $2::uuid ORDER BY created_at DESC, id`,
      [userId, threadId ?? null]
    )
    return res.rows.map(mapSource)
  }

  async content(userId: string, id: string): Promise<{ content: string | null }> {
    const res = await this.db.query(`SELECT content FROM ai_sources WHERE id = $1 AND user_id = $2`, [id, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tài liệu')
    return { content: res.rows[0].content }
  }

  async add(userId: string, input: AiSourceInput): Promise<AiSource> {
    const threadId = input.threadId
    if (threadId) await this.assertThread(userId, threadId)
    switch (input.type) {
      case 'file':
        return this.addFile(userId, threadId, input.file as SourceFile)
      case 'text':
        return this.insert(userId, threadId, { kind: 'text', title: input.title || firstLine(input.content), content: input.content })
      case 'link':
        return this.addLink(userId, threadId, input.url)
      case 'copy':
        return this.copy(userId, input.threadId, input.sourceId)
    }
  }

  // Bật / tắt tài liệu cho N7AI đọc (không xóa gì)
  async patch(userId: string, id: string, input: AiSourcePatch): Promise<AiSource> {
    const res = await this.db.query(`UPDATE ai_sources SET in_context = $3 WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`, [id, userId, input.inContext])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy tài liệu')
    return mapSource(res.rows[0])
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const res = await this.db.query(`DELETE FROM ai_sources WHERE id = $1 AND user_id = $2`, [id, userId])
    if (!res.rowCount) throw new NotFoundException('Không tìm thấy tài liệu')
    return { deleted: true }
  }

  // Tài liệu của thread cho lượt trả lời: tệp (đọc qua attachmentParts) + chữ đã lưu; bỏ tài liệu đã tắt và tệp đã có ở tin gửi / tin trước
  async context(userId: string, threadId: string, skipKeys: ReadonlySet<string>): Promise<{ files: ChatAttachment[]; texts: SourceText[] }> {
    const res = await this.db.query(
      `SELECT kind, title, url, file_key, mime, size, content, meta FROM ai_sources WHERE user_id = $1 AND thread_id = $2 AND in_context ORDER BY created_at DESC`,
      [userId, threadId]
    )
    const files = res.rows.filter((r) => r.kind === 'file' && !skipKeys.has(r.file_key)).map(toAttachment)
    const texts: SourceText[] = res.rows.filter((r) => r.kind !== 'file' && r.content).map((r) => ({ title: r.title, kind: r.kind, url: r.url, content: r.content, meta: r.meta }))
    return { files, texts }
  }

  private async assertThread(userId: string, threadId: string) {
    const res = await this.db.query(`SELECT 1 FROM conversations WHERE id = $1 AND type = 'ai' AND created_by = $2`, [threadId, userId])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy cuộc trò chuyện')
  }

  private async addFile(userId: string, threadId: string | undefined, file: SourceFile) {
    if (!this.storage.isOwnedKey(file.key, 'chat', userId)) throw new BadRequestException('Tệp không hợp lệ')
    if (!isLearnable(file.mime)) throw new BadRequestException('N7AI chưa đọc được định dạng này. Dùng PDF, Word, PowerPoint, Excel, văn bản hoặc ảnh.')
    const existing = await this.db.query(`SELECT ${COLUMNS} FROM ai_sources WHERE user_id = $1 AND thread_id IS NOT DISTINCT FROM $2::uuid AND file_key = $3`, [userId, threadId ?? null, file.key])
    if (existing.rows[0]) return mapSource(existing.rows[0]) // thêm lại cùng tệp ⇒ giữ nguyên
    return this.insert(userId, threadId, { kind: 'file', title: file.name, url: this.storage.publicUrlFor(file.key), fileKey: file.key, mime: file.mime, size: file.size })
  }

  private async addLink(userId: string, threadId: string | undefined, raw: string) {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BadRequestException('Chỉ nhận liên kết http hoặc https')
    const videoId = youtubeId(raw)
    // Cùng video dán bằng nhiều dạng link (youtu.be, shorts, có &t=…) ⇒ so theo link chuẩn
    const canonical = videoId ? watchUrl(videoId) : url.toString()
    const existing = await this.db.query(`SELECT ${COLUMNS} FROM ai_sources WHERE user_id = $1 AND thread_id IS NOT DISTINCT FROM $2::uuid AND url = $3`, [userId, threadId ?? null, canonical])
    if (existing.rows[0]) return mapSource(existing.rows[0])

    if (videoId) {
      const video = await fetchYoutubeTranscript(videoId).catch((err: unknown) => {
        if (err instanceof YoutubeTranscriptError && err.code === 'no-captions') {
          throw new UnprocessableEntityException('Video này chưa có phụ đề nên N7AI chưa đọc được. Hãy dùng video có phụ đề hoặc dán nội dung vào.')
        }
        throw new BadGatewayException('Không tải được video YouTube. Thử lại sau hoặc dán nội dung vào.')
      })
      const meta: AiSourceMeta = { videoId, lang: video.lang, auto: video.auto, author: video.author, seconds: video.seconds }
      return this.insert(userId, threadId, { kind: 'youtube', title: video.title, url: watchUrl(videoId), content: video.text.slice(0, AI_SOURCE_TEXT_MAX), meta })
    }

    const page = await this.web.readPage(url.toString(), AI_SOURCE_TEXT_MAX).catch((err: Error) => {
      throw new UnprocessableEntityException(
        err.message === 'unsupported' ? 'Liên kết này không phải trang web hoặc văn bản. Tải tệp lên thay vì dán liên kết.' : 'Không đọc được liên kết. Kiểm tra lại địa chỉ (trang phải công khai).'
      )
    })
    if (page.text.length < 50) throw new UnprocessableEntityException('Trang này gần như không có chữ để đọc (có thể cần đăng nhập hoặc tải bằng JavaScript).')
    return this.insert(userId, threadId, { kind: 'url', title: page.title, url: page.url, content: page.text })
  }

  // Thêm tài liệu của mình (thư viện hoặc thread khác) vào thread: nhân bản dòng, giữ nguyên tệp trên R2
  private async copy(userId: string, threadId: string, sourceId: string) {
    const res = await this.db.query(`SELECT kind, title, url, file_key, mime, size, content, meta FROM ai_sources WHERE id = $1 AND user_id = $2`, [sourceId, userId])
    const src = res.rows[0]
    if (!src) throw new NotFoundException('Không tìm thấy tài liệu')
    if (src.kind === 'file') return this.addFile(userId, threadId, { key: src.file_key, name: src.title, size: src.size, mime: src.mime })
    return this.insert(userId, threadId, { kind: src.kind, title: src.title, url: src.url, content: src.content, meta: src.meta })
  }

  private async insert(
    userId: string,
    threadId: string | undefined,
    s: { kind: AiSource['kind']; title: string; url?: string | null; fileKey?: string; mime?: string; size?: number; content?: string; meta?: AiSourceMeta | null }
  ): Promise<AiSource> {
    const limit = threadId ? THREAD_LIMIT : LIBRARY_LIMIT
    const res = await this.db.query(
      `INSERT INTO ai_sources (user_id, thread_id, kind, title, url, file_key, mime, size, content, meta)
       SELECT $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
       WHERE (SELECT COUNT(*) FROM ai_sources WHERE user_id = $1 AND thread_id IS NOT DISTINCT FROM $2::uuid) < $11
       RETURNING ${COLUMNS}`,
      [userId, threadId ?? null, s.kind, s.title.slice(0, 200), s.url ?? null, s.fileKey ?? null, s.mime ?? null, s.size ?? null, s.content ?? null, s.meta ? JSON.stringify(s.meta) : null, limit]
    )
    if (!res.rows[0]) throw new BadRequestException(`Tối đa ${limit} tài liệu ${threadId ? 'trong một cuộc trò chuyện' : 'trong thư viện'}`)
    return mapSource(res.rows[0])
  }
}

const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`

// Tiêu đề cho văn bản dán: dòng đầu có chữ, ngắn gọn
function firstLine(content: string): string {
  const line = content.split('\n').find((l) => l.trim()) ?? 'Văn bản dán'
  return line.trim().slice(0, 60)
}
