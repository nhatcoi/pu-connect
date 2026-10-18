import { Injectable, Logger } from '@nestjs/common'
import type { AiConnectorId } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { WebReaderService } from './connectors/web-reader.service'

export type Source = {
  type: 'post' | 'document' | 'course' | 'thread' | 'study_set' | 'group' | 'drive' | 'calendar' | 'web'
  id: string
  title: string
  body: string
}

// Connector tài khoản ngoài lỗi ⇒ báo N7AI nói rõ (không trả lời như chưa từng kết nối)
export type ConnectorFailure = { name: string; message: string }
export type Retrieved = { sources: Source[]; failures: ConnectorFailure[] }


export interface RetrieveOptions {
  connectors?: AiConnectorId[] // mặc định: ['library']
  research?: boolean // truy xuất sâu hơn (nhiều nguồn, thân dài hơn)
}

// Bỏ dấu tiếng Việt (khớp cột search_tsv đã unaccent)
const unaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Hư từ / từ phổ biến (đã bỏ dấu): khớp gần như mọi bài ⇒ bỏ khỏi truy vấn
// Stopwords (unaccented): match nearly every post ⇒ dropped
const STOPWORDS = new Set(
  (
    'cua minh toi ban la va cho cac nhung mot nhu the nao gi co khong duoc voi trong tu den nay do thi ma se da dang hay hoac cung rat ' +
    'lam sao giup doc xem hoi oi nhe ve ra vao len khi neu de vi boi nen tai theo sau truoc tren duoi cai con nguoi nhieu it moi hon nhat ' +
    'roi chua ah a u nha nhi vay day kia ai bao muon can biet noi viet tao dum ho ' +
    'the and of to in is are for how what why on with my me you can please'
  ).split(' ')
)
const MAX_KEYWORDS = 8

// Từ khóa → tsquery "khớp ≥ 2 từ" (1 từ ⇒ chính nó); từ ≥ 3 ký tự khớp tiền tố
// Keywords → tsquery requiring ≥ 2 matched terms ('' if none)
function toTsQuery(question: string): string {
  const words = Array.from(
    new Set(
      unaccent(question)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    )
  )
    .slice(0, MAX_KEYWORDS)
    .map((w) => (w.length >= 3 ? `${w}:*` : w))
  if (words.length <= 1) return words.join('')
  const pairs: string[] = []
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) pairs.push(`(${words[i]} & ${words[j]})`)
  return pairs.join(' | ')
}

// Truy xuất nguồn cho N7AI (chat, bình luận): mỗi connector 1 truy vấn, chạy song song
@Injectable()
export class AiRetrieval {
  private readonly logger = new Logger(AiRetrieval.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly web: WebReaderService
  ) {}

  async retrieve(question: string, requesterId: string, opts: RetrieveOptions = {}): Promise<Retrieved> {
    const connectors = new Set(opts.connectors ?? ['library'])
    const tsquery = toTsQuery(question)
    const research = !!opts.research
    const tasks: Promise<Source[]>[] = []
    const failures: ConnectorFailure[] = []
    if (connectors.has('library') && tsquery) tasks.push(this.safe('library', () => this.library(tsquery, requesterId, research)))
    if (connectors.has('my_documents') && tsquery) tasks.push(this.safe('my_documents', () => this.myDocuments(tsquery, requesterId, research)))
    if (connectors.has('my_groups')) tasks.push(this.safe('my_groups', () => this.myGroups(requesterId)))
    if (connectors.has('web')) tasks.push(this.safe('web', () => this.webPages(question, research)))
    if (connectors.has('web_search')) tasks.push(this.safe('web_search', () => this.webSearch(question, research)))
    return { sources: (await Promise.all(tasks)).flat(), failures }
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

  // Đọc trang web có URL trong câu hỏi
  private async webPages(question: string, research: boolean): Promise<Source[]> {
    const pages = await this.web.readUrls(question, research ? 8000 : 4000)
    return pages.map((p) => ({ type: 'web' as const, id: p.id, title: p.title, body: p.body }))
  }

  // Tìm kiếm web (Tavily) — 3 kết quả, Research 5
  private async webSearch(question: string, research: boolean): Promise<Source[]> {
    const results = await this.web.search(question, research ? 5 : 3)
    return results.map((r) => ({ type: 'web' as const, id: r.id, title: r.title, body: r.body }))
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

// Gói nguồn vào khối <context> (dữ liệu, không phải chỉ dẫn); n = số thứ tự để N7AI ghi nguồn đã dùng
// Connector lỗi ⇒ <connector_error> để N7AI báo đúng lý do
export function contextBlock(sources: Source[], failures: ConnectorFailure[] = []): string {
  if (!sources.length && !failures.length) return ''
  const body = sources.map((s, i) => `<data n="${i + 1}" source="${s.type}:${s.id}" title="${attr(s.title)}">\n${s.body}\n</data>`)
  const errors = failures.map((f) => `<connector_error name="${attr(f.name)}">${f.message}</connector_error>`)
  return `<context>\n${[...body, ...errors].join('\n')}\n</context>\n\n`
}

const attr = (s: string) => s.replace(/"/g, "'")
