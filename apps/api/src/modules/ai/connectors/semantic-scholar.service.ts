import { Injectable, Logger } from '@nestjs/common'
import type { Source } from '../ai.retrieval'

export interface AcademicPaper {
  id: string
  title: string
  abstract: string
  authors: string[]
  year?: number
  citationCount?: number
  influentialCitationCount?: number
  url: string
  pdfUrl?: string
  venue?: string
  fieldsOfStudy?: string[]
  source: 'Semantic Scholar' | 'arXiv'
}

const CACHE_TTL_MS = 10 * 60_000 // cùng từ khóa trong 10 phút ⇒ dùng lại kết quả
const CACHE_MAX = 200
const ARXIV_GAP_MS = 3100
const ARXIV_TIMEOUT_MS = 15_000

export class AcademicSearchUnavailableError extends Error {
  constructor() {
    super('Dịch vụ tìm bài báo (Semantic Scholar, arXiv) đang quá tải hoặc không phản hồi, thử lại sau')
  }
}

// Trình kết nối bài báo khoa học toàn cầu: Semantic Scholar API + fallback arXiv
// Global academic research paper connector: Semantic Scholar Graph API + seamless arXiv fallback
@Injectable()
export class SemanticScholarService {
  private readonly logger = new Logger(SemanticScholarService.name)
  private readonly baseUrl = 'https://api.semanticscholar.org/graph/v1'
  private readonly arxivUrl = 'https://export.arxiv.org/api/query'
  private readonly cache = new Map<string, { sources: Source[]; expires: number }>()
  private arxivQueue: Promise<void> = Promise.resolve()
  private arxivLastAt = 0

  // Tìm kiếm bài báo khoa học theo từ khóa / Search academic papers by query
  // Lỗi (cả Semantic Scholar lẫn arXiv đều không trả lời) ⇒ ném AcademicSearchUnavailableError, KHÁC với "không có bài" ([])
  // ⇒ model biết dịch vụ đang lỗi, không đổi từ khóa thử lại nhiều lần
  async search(query: string, limit = 5, year?: string): Promise<Source[]> {
    const cleanQuery = query.trim().replace(/["\n\r]+/g, ' ')
    if (!cleanQuery) return []

    const boundedLimit = Math.min(Math.max(limit, 1), 10)
    const key = `${cleanQuery.toLowerCase()}|${boundedLimit}|${year ?? ''}`
    const hit = this.cache.get(key)
    if (hit && hit.expires > Date.now()) return hit.sources

    // 1. Semantic Scholar trước; 429 / lỗi / rỗng ⇒ arXiv
    const s2Papers = await this.searchSemanticScholar(cleanQuery, boundedLimit, year)
    let papers = s2Papers?.length ? s2Papers : await this.searchArxiv(cleanQuery, boundedLimit)
    if (papers === null && s2Papers) papers = s2Papers // S2 trả rỗng thật, arXiv lỗi ⇒ vẫn là "không có bài"
    if (papers === null) throw new AcademicSearchUnavailableError()

    const sources = this.toSources(papers)
    this.remember(key, sources)
    return sources
  }

  private remember(key: string, sources: Source[]) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string)
    this.cache.set(key, { sources, expires: Date.now() + CACHE_TTL_MS })
  }

  // Tra cứu chi tiết một bài báo qua Semantic Scholar / Lookup paper details
  async getPaper(paperId: string): Promise<Source | null> {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim()
    const url = `${this.baseUrl}/paper/${encodeURIComponent(paperId)}?fields=paperId,title,abstract,authors,year,citationCount,influentialCitationCount,openAccessPdf,url,venue,fieldsOfStudy`

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'PU Connect/1.0 (academic-assistant; contact: admin@puc.vnhat.dev)'
      }
      if (apiKey) headers['x-api-key'] = apiKey

      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      const p = (await res.json()) as Record<string, unknown>
      const paper: AcademicPaper = {
        id: String(p.paperId || paperId),
        title: String(p.title || 'Untitled Paper'),
        abstract: typeof p.abstract === 'string' ? p.abstract : '',
        authors: Array.isArray(p.authors) ? p.authors.map((a: { name?: string }) => a.name || 'Unknown') : [],
        year: typeof p.year === 'number' ? p.year : undefined,
        citationCount: typeof p.citationCount === 'number' ? p.citationCount : undefined,
        influentialCitationCount: typeof p.influentialCitationCount === 'number' ? p.influentialCitationCount : undefined,
        url: typeof p.url === 'string' ? p.url : `https://www.semanticscholar.org/paper/${p.paperId || paperId}`,
        pdfUrl: (p.openAccessPdf as { url?: string } | undefined)?.url,
        venue: typeof p.venue === 'string' ? p.venue : undefined,
        fieldsOfStudy: Array.isArray(p.fieldsOfStudy) ? p.fieldsOfStudy.filter((f): f is string => typeof f === 'string') : [],
        source: 'Semantic Scholar'
      }
      return this.toSource(paper)
    } catch (err: unknown) {
      this.logger.debug(`Không lấy được chi tiết bài báo ${paperId}: ${(err as Error)?.message}`)
      return null
    }
  }

  // Gọi Semantic Scholar Graph API
  private async searchSemanticScholar(query: string, limit: number, year?: string): Promise<AcademicPaper[] | null> {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim()
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      fields: 'paperId,title,abstract,authors,year,citationCount,influentialCitationCount,openAccessPdf,url,venue,fieldsOfStudy'
    })
    if (year) params.set('year', year)

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'PU Connect/1.0 (academic-assistant; contact: admin@puc.vnhat.dev)'
      }
      if (apiKey) headers['x-api-key'] = apiKey

      const res = await fetch(`${this.baseUrl}/paper/search?${params.toString()}`, {
        headers,
        signal: AbortSignal.timeout(8000)
      })

      if (!res.ok) {
        this.logger.debug(`Semantic Scholar API trả về mã ${res.status}, tự động chuyển sang arXiv`)
        return null
      }

      const json = (await res.json()) as { data?: Record<string, unknown>[] }
      if (!Array.isArray(json.data) || json.data.length === 0) return []

      return json.data.map((p) => ({
        id: String(p.paperId || ''),
        title: String(p.title || 'Untitled Paper').replace(/\s+/g, ' ').trim(),
        abstract: typeof p.abstract === 'string' ? p.abstract.replace(/\s+/g, ' ').trim() : '',
        authors: Array.isArray(p.authors) ? p.authors.map((a: { name?: string }) => a.name || 'Unknown') : [],
        year: typeof p.year === 'number' ? p.year : undefined,
        citationCount: typeof p.citationCount === 'number' ? p.citationCount : undefined,
        influentialCitationCount: typeof p.influentialCitationCount === 'number' ? p.influentialCitationCount : undefined,
        url: typeof p.url === 'string' ? p.url : `https://www.semanticscholar.org/paper/${p.paperId}`,
        pdfUrl: (p.openAccessPdf as { url?: string } | undefined)?.url,
        venue: typeof p.venue === 'string' ? p.venue : undefined,
        fieldsOfStudy: Array.isArray(p.fieldsOfStudy) ? p.fieldsOfStudy.filter((f): f is string => typeof f === 'string') : [],
        source: 'Semantic Scholar'
      }))
    } catch (err: unknown) {
      this.logger.debug(`Semantic Scholar tìm kiếm thất bại: ${(err as Error)?.message}, lùi về arXiv`)
      return null
    }
  }

  // Gọi arXiv API (Atom/XML feed)
  // arXiv giới hạn ~1 yêu cầu / 3 giây ⇒ xếp hàng tuần tự (gọi song song là bị treo rồi hết giờ)
  private searchArxiv(query: string, limit: number): Promise<AcademicPaper[] | null> {
    const run = this.arxivQueue.then(async () => {
      const wait = this.arxivLastAt + ARXIV_GAP_MS - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      try {
        return await this.fetchArxiv(query, limit)
      } finally {
        this.arxivLastAt = Date.now()
      }
    })
    this.arxivQueue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async fetchArxiv(query: string, limit: number): Promise<AcademicPaper[] | null> {
    const url = `${this.arxivUrl}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=relevance`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(ARXIV_TIMEOUT_MS) })
      if (!res.ok) return null
      const text = await res.text()

      const papers: AcademicPaper[] = []
      const entryMatches = text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)

      for (const match of entryMatches) {
        const raw = match[1]
        const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/)
        const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Untitled Paper'

        const summaryMatch = raw.match(/<summary>([\s\S]*?)<\/summary>/)
        const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim() : ''

        const publishedMatch = raw.match(/<published>([\s\S]*?)<\/published>/)
        const year = publishedMatch ? new Date(publishedMatch[1].trim()).getFullYear() : undefined

        const authors = Array.from(raw.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)).map((m) =>
          m[1].replace(/\s+/g, ' ').trim()
        )

        const idMatch = raw.match(/<id>([\s\S]*?)<\/id>/)
        const id = idMatch ? idMatch[1].trim() : ''

        const pdfMatch =
          raw.match(/<link[^>]*?title=["']pdf["'][^>]*?href=["']([^"']+)["']/i) ||
          raw.match(/<link[^>]*?href=["']([^"']+)["'][^>]*?title=["']pdf["']/i)
        const pdfUrl = pdfMatch ? pdfMatch[1].trim() : undefined

        const catMatch = raw.match(/<arxiv:primary_category[^>]*?term=["']([^"']+)["']/)
        const venue = catMatch ? `arXiv:${catMatch[1]}` : 'arXiv'

        papers.push({
          id,
          title,
          abstract,
          authors: authors.length ? authors : ['Unknown'],
          year,
          url: id,
          pdfUrl,
          venue,
          source: 'arXiv'
        })
      }

      return papers
    } catch (err: unknown) {
      this.logger.warn(`arXiv tìm kiếm thất bại: ${(err as Error)?.message}`)
      return null
    }
  }

  // Chuyển đổi sang đối tượng Source thống nhất với hệ thống trích dẫn của PU Connect
  private toSource(paper: AcademicPaper): Source {
    const lines = [
      `Tác giả: ${paper.authors.length ? paper.authors.join(', ') : 'Không rõ'}`,
      `Năm xuất bản: ${paper.year ?? 'N/A'}`,
      paper.citationCount !== undefined ? `Số trích dẫn: ${paper.citationCount.toLocaleString()} lượt` : null,
      paper.venue ? `Nơi công bố: ${paper.venue}` : null,
      paper.pdfUrl ? `Link PDF: ${paper.pdfUrl}` : null,
      `Cơ sở dữ liệu: ${paper.source}`,
      `Tóm tắt (Abstract): ${paper.abstract || 'Không có tóm tắt.'}`
    ]

    return {
      type: 'paper',
      id: paper.url || paper.pdfUrl || paper.id,
      title: `${paper.title}${paper.year ? ` (${paper.year})` : ''}`,
      body: lines.filter(Boolean).join('\n')
    }
  }

  private toSources(papers: AcademicPaper[]): Source[] {
    return papers.map((p) => this.toSource(p))
  }
}
