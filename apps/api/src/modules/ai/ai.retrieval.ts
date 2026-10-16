import { Injectable, Logger } from '@nestjs/common'
import type { AiConnectorId } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { GoogleCalendarService } from './connectors/google-calendar.service'
import { GoogleDriveService } from './connectors/google-drive.service'

export type Source = { type: 'post' | 'document' | 'course' | 'thread' | 'group' | 'drive' | 'calendar'; id: string; title: string; body: string }

export interface RetrieveOptions {
  connectors?: AiConnectorId[] // mặc định: ['library']
  research?: boolean // truy xuất sâu hơn (nhiều nguồn, thân dài hơn)
}

// Bỏ dấu tiếng Việt (khớp cột search_tsv đã unaccent)
const unaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Từ khóa → tsquery OR tiền tố ('' nếu không có từ nào đủ dài)
function toTsQuery(question: string): string {
  const words = Array.from(
    new Set(
      unaccent(question)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2)
    )
  ).slice(0, 12)
  return words.map((w) => `${w}:*`).join(' | ')
}

// Truy xuất nguồn cho PU AI (chat, bình luận): mỗi connector 1 truy vấn, chạy song song
@Injectable()
export class AiRetrieval {
  private readonly logger = new Logger(AiRetrieval.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly drive: GoogleDriveService,
    private readonly calendar: GoogleCalendarService
  ) {}

  async retrieve(question: string, requesterId: string, opts: RetrieveOptions = {}): Promise<Source[]> {
    const connectors = new Set(opts.connectors?.length ? opts.connectors : ['library'])
    const tsquery = toTsQuery(question)
    const research = !!opts.research
    const tasks: Promise<Source[]>[] = []
    if (connectors.has('library') && tsquery) tasks.push(this.safe('library', () => this.library(tsquery, requesterId, research)))
    if (connectors.has('my_documents') && tsquery) tasks.push(this.safe('my_documents', () => this.myDocuments(tsquery, requesterId, research)))
    if (connectors.has('my_groups')) tasks.push(this.safe('my_groups', () => this.myGroups(requesterId)))
    if (connectors.has('google_drive')) tasks.push(this.safe('google_drive', () => this.googleDrive(question, requesterId, research)))
    if (connectors.has('google_calendar')) tasks.push(this.safe('google_calendar', () => this.googleCalendar(requesterId, research)))
    return (await Promise.all(tasks)).flat()
  }

  // Lỗi 1 connector không làm hỏng câu trả lời
  private async safe(name: string, fn: () => Promise<Source[]>): Promise<Source[]> {
    try {
      return await fn()
    } catch (err: any) {
      this.logger.warn(`Truy xuất ${name} thất bại: ${err?.message}`)
      return []
    }
  }

  // Thư viện PU: full-text bài viết & tài liệu công khai (+ của mình), kèm lời giải đã duyệt
  private async library(tsquery: string, requesterId: string, research: boolean): Promise<Source[]> {
    const [posts, docs, body] = research ? [8, 4, 2500] : [4, 2, 1500]
    const res = await this.db.query(
      `WITH q AS (SELECT to_tsquery('simple', $1) AS tsq)
       (SELECT 'post' AS type, p.id, COALESCE(NULLIF(p.title, ''), left(p.content, 80)) AS title,
               left(p.content, $5) AS body,
               (SELECT left(c.content, 1000) FROM comments c WHERE c.post_id = p.id AND c.is_solution LIMIT 1) AS solution,
               ts_rank(p.search_tsv, q.tsq) AS rank
        FROM posts p, q
        WHERE p.search_tsv @@ q.tsq AND p.hidden_at IS NULL
          AND (p.visibility = 'public' OR p.author_id = $2)
        ORDER BY rank DESC LIMIT $3)
       UNION ALL
       (SELECT 'document', d.id, d.title, left(COALESCE(d.description, ''), $5), NULL, ts_rank(d.search_tsv, q.tsq)
        FROM documents d, q
        WHERE d.search_tsv @@ q.tsq AND (d.visibility = 'public' OR d.owner_id = $2)
        ORDER BY 6 DESC LIMIT $4)`,
      [tsquery, requesterId, posts, docs, body]
    )
    return res.rows
      .filter((r) => r.rank > 0)
      .map((r) => ({
        type: r.type,
        id: r.id,
        title: r.title,
        body: r.solution ? `${r.body}\n\n[Lời giải đã được tác giả duyệt]\n${r.solution}` : r.body
      }))
  }

  // Tài liệu của tôi: đoạn nội dung tệp (document_chunks) khớp câu hỏi — chỉ quét tài liệu của mình
  private async myDocuments(tsquery: string, requesterId: string, research: boolean): Promise<Source[]> {
    const res = await this.db.query(
      `WITH q AS (SELECT to_tsquery('simple', $1) AS tsq)
       SELECT d.id, d.title, left(x.content_text, 1500) AS body
       FROM documents d
       CROSS JOIN q
       CROSS JOIN LATERAL (
         SELECT c.content_text, ts_rank(to_tsvector('simple', immutable_unaccent(lower(c.content_text))), q.tsq) AS rank
         FROM document_chunks c WHERE c.document_id = d.id
         ORDER BY rank DESC LIMIT 1
       ) x
       WHERE d.owner_id = $2 AND x.rank > 0
       ORDER BY x.rank DESC LIMIT $3`,
      [tsquery, requesterId, research ? 4 : 2]
    )
    return res.rows.map((r) => ({ type: 'document' as const, id: r.id, title: r.title, body: r.body }))
  }

  // Google Drive (đã kết nối): file khớp từ khóa, đọc nội dung
  private async googleDrive(question: string, requesterId: string, research: boolean): Promise<Source[]> {
    const files = await this.drive.search(requesterId, question, research ? 4 : 2)
    return files.map((f) => ({ type: 'drive' as const, id: f.id, title: f.title, body: f.body }))
  }

  // Google Calendar (đã kết nối): lịch 14 ngày tới (Research: 30 ngày)
  private async googleCalendar(requesterId: string, research: boolean): Promise<Source[]> {
    const events = await this.calendar.upcoming(requesterId, research ? 30 : 14, research ? 40 : 20)
    return events.map((e) => ({ type: 'calendar' as const, id: e.id, title: e.title, body: e.body }))
  }

  // Nhóm học của tôi: tóm tắt ngắn (không phụ thuộc câu hỏi, ≤ 5 nhóm)
  private async myGroups(requesterId: string): Promise<Source[]> {
    const res = await this.db.query(
      `SELECT sg.id, sg.name, sg.topic, sg.course_code, sg.course_name, left(sg.description, 300) AS description
       FROM study_group_members gm JOIN study_groups sg ON sg.id = gm.group_id
       WHERE gm.user_id = $1 ORDER BY gm.joined_at DESC LIMIT 5`,
      [requesterId]
    )
    if (!res.rows.length) return []
    const body = res.rows
      .map((g) => `- ${g.name}${g.course_code ? ` (${g.course_code} ${g.course_name ?? ''})` : ''}: ${g.topic}. ${g.description ?? ''}`)
      .join('\n')
    return [{ type: 'group', id: 'my-groups', title: 'Nhóm học của tôi', body }]
  }
}

// Gói nguồn vào khối <context> (dữ liệu, không phải chỉ dẫn)
export function contextBlock(sources: Source[]): string {
  if (!sources.length) return ''
  const body = sources.map((s) => `<data source="${s.type}:${s.id}" title="${s.title.replace(/"/g, "'")}">\n${s.body}\n</data>`).join('\n')
  return `<context>\n${body}\n</context>\n\n`
}
