import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'

export type Source = { type: 'post' | 'document'; id: string; title: string; body: string }

// Bỏ dấu tiếng Việt (khớp cột search_tsv đã unaccent)
const unaccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Truy xuất nguồn cho PU AI (chat, bình luận): full-text (OR từ khóa) trên bài viết & tài liệu công khai, kèm lời giải đã duyệt
@Injectable()
export class AiRetrieval {
  private readonly logger = new Logger(AiRetrieval.name)

  constructor(private readonly db: DatabaseService) {}

  async retrieve(question: string, requesterId: string): Promise<Source[]> {
    const words = Array.from(
      new Set(
        unaccent(question)
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 2)
      )
    ).slice(0, 12)
    if (!words.length) return []
    const tsquery = words.map((w) => `${w}:*`).join(' | ')
    try {
      const res = await this.db.query(
        `WITH q AS (SELECT to_tsquery('simple', $1) AS tsq)
         (SELECT 'post' AS type, p.id, COALESCE(NULLIF(p.title, ''), left(p.content, 80)) AS title,
                 left(p.content, 1500) AS body,
                 (SELECT left(c.content, 1000) FROM comments c WHERE c.post_id = p.id AND c.is_solution LIMIT 1) AS solution,
                 ts_rank(p.search_tsv, q.tsq) AS rank
          FROM posts p, q
          WHERE p.search_tsv @@ q.tsq AND p.hidden_at IS NULL
            AND (p.visibility = 'public' OR p.author_id = $2)
          ORDER BY rank DESC LIMIT 4)
         UNION ALL
         (SELECT 'document', d.id, d.title, left(COALESCE(d.description, ''), 800), NULL, ts_rank(d.search_tsv, q.tsq)
          FROM documents d, q
          WHERE d.search_tsv @@ q.tsq AND (d.visibility = 'public' OR d.owner_id = $2)
          ORDER BY 6 DESC LIMIT 2)`,
        [tsquery, requesterId]
      )
      return res.rows
        .filter((r) => r.rank > 0)
        .map((r) => ({
          type: r.type,
          id: r.id,
          title: r.title,
          body: r.solution ? `${r.body}\n\n[Lời giải đã được tác giả duyệt]\n${r.solution}` : r.body
        }))
    } catch (err: any) {
      this.logger.warn(`Truy xuất nguồn thất bại: ${err?.message}`)
      return []
    }
  }
}

// Gói nguồn vào khối <context> (dữ liệu, không phải chỉ dẫn)
export function contextBlock(sources: Source[]): string {
  if (!sources.length) return ''
  const body = sources
    .map((s) => `<data source="${s.type}:${s.id}" title="${s.title.replace(/"/g, "'")}">\n${s.body}\n</data>`)
    .join('\n')
  return `<context>\n${body}\n</context>\n\n`
}
