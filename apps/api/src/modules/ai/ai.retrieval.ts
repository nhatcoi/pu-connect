import { Injectable, Logger } from '@nestjs/common'
import type { AiConnectorId } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { SemanticScholarService } from './connectors/semantic-scholar.service'
import { WebReaderService } from './connectors/web-reader.service'
import { RagSearchService, type RagQuery } from './rag/rag-search.service'

export type Source = {
  type: 'post' | 'document' | 'course' | 'thread' | 'study_set' | 'group' | 'drive' | 'calendar' | 'web' | 'paper'
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
  // Tiến trình từng connector (UI "Đang tìm trong Thư viện PU…" → "4 nguồn")
  onStage?: (connector: AiConnectorId, state: 'running' | 'done' | 'error', found?: number) => void
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
export function toTsQuery(question: string): string {
  // Preserve explicit acronyms (AI), while lowercase Vietnamese 'ai' remains a stopword.
  const acronyms = new Set((question.match(/\b[A-Z]{2,}\b/g) ?? []).map((word) => word.toLowerCase()))
  const words = Array.from(
    new Set(
      unaccent(question)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2 && (!STOPWORDS.has(w) || acronyms.has(w)))
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
    private readonly web: WebReaderService,
    private readonly rag: RagSearchService,
    private readonly semanticScholar: SemanticScholarService
  ) {}

  async retrieve(question: string, requesterId: string, opts: RetrieveOptions = {}): Promise<Retrieved> {
    const connectors = new Set(opts.connectors ?? ['library'])
    const research = !!opts.research
    const tasks: Promise<Source[]>[] = []
    const failures: ConnectorFailure[] = []
    const safe = (name: AiConnectorId, fn: () => Promise<Source[]>) => this.safe(name, fn, opts.onStage, failures)
    // Thư viện / tài liệu của tôi: tìm kết hợp full-text + vector (vector tính 1 lần cho cả hai)
    if (connectors.has('library') || connectors.has('my_documents')) {
      const query = this.rag.prepare(question, toTsQuery(question))
      if (connectors.has('library')) tasks.push(safe('library', async () => this.library(await query, requesterId, research)))
      if (connectors.has('my_documents')) tasks.push(safe('my_documents', async () => this.myDocuments(await query, requesterId, research)))
    }
    if (connectors.has('my_groups')) tasks.push(safe('my_groups', () => this.myGroups(requesterId)))
    if (connectors.has('web')) tasks.push(safe('web', () => this.webPages(question, research)))
    if (connectors.has('web_search')) tasks.push(safe('web_search', () => this.webSearch(question, research)))
    if (connectors.has('semantic_scholar')) tasks.push(safe('semantic_scholar', () => this.academicPapers(question, research)))
    return { sources: (await Promise.all(tasks)).flat(), failures }
  }

  // Lỗi 1 connector không làm hỏng câu trả lời
  private async safe(name: AiConnectorId, fn: () => Promise<Source[]>, onStage: RetrieveOptions['onStage'], failures: ConnectorFailure[] = []): Promise<Source[]> {
    onStage?.(name, 'running')
    try {
      const found = await fn()
      onStage?.(name, 'done', found.length)
      return found
    } catch (err: any) {
      this.logger.warn(`Truy xuất ${name} thất bại: ${err?.message}`)
      onStage?.(name, 'error')
      failures.push({ name, message: String(err?.message || 'Không truy cập được') })
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

  // Bài báo khoa học toàn cầu (Semantic Scholar & arXiv) — 3 kết quả, Research 6
  private async academicPapers(question: string, research: boolean): Promise<Source[]> {
    return this.semanticScholar.search(question, research ? 6 : 3)
  }

  // Thư viện PU: bài viết & tài liệu công khai (+ của mình), kèm lời giải đã duyệt
  private async library(query: RagQuery, requesterId: string, research: boolean): Promise<Source[]> {
    if (!query.tsquery && !query.vector) return []
    const [posts, docs, bodyChars] = research ? [8, 4, 2500] : [4, 2, 1500]
    const [p, d] = await Promise.all([
      this.rag.posts(query, requesterId, { limit: posts, bodyChars }),
      this.rag.documents(query, requesterId, { limit: docs, bodyChars })
    ])
    return [...p, ...d]
  }

  // Tài liệu của tôi: đoạn nội dung tệp khớp câu hỏi — chỉ tài liệu của mình (kể cả riêng tư)
  private async myDocuments(query: RagQuery, requesterId: string, research: boolean): Promise<Source[]> {
    if (!query.tsquery && !query.vector) return []
    return this.rag.documents(query, requesterId, { limit: research ? 4 : 2, bodyChars: 1500, ownerOnly: true })
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
