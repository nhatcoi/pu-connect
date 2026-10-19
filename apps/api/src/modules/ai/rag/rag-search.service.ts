import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../database/database.service'
import type { Source } from '../ai.retrieval'
import { EmbeddingService, toVectorLiteral } from './embedding.service'

const RRF_K = 60 // Reciprocal Rank Fusion: điểm = Σ 1 / (K + hạng) qua các danh sách
const CANDIDATES = 24 // ứng viên mỗi danh sách trước khi gộp
const DOC_LEVEL_CANDIDATES = 10
const CHUNKS_PER_DOC = 2
// Cosine tối thiểu để một nguồn được tính là liên quan — hiệu chỉnh bằng `rag:eval` (2026-10-19: nguồn đúng thấp nhất 0.519, p10 0.61)
export const MIN_SIMILARITY = 0.5

// Câu hỏi đã chuẩn bị: tsquery (full-text) + vector (null ⇒ chỉ full-text)
export type RagQuery = { tsquery: string; vector: number[] | null }
export type RagMode = 'hybrid' | 'fulltext' | 'vector'
type SearchOpts = { limit: number; bodyChars: number; mode?: RagMode }

// Trọng số danh sách full-text khi gộp với vector (eval 2026-10-19: vector xếp hạng đúng hơn, full-text giữ vai trò cộng điểm)
export const FULLTEXT_WEIGHT = Number(process.env.RAG_FULLTEXT_WEIGHT ?? 0.5)

// Gộp nhiều danh sách xếp hạng (id đã bỏ trùng theo thứ tự) bằng RRF có trọng số
export function fuseRankings(lists: string[][], weights: number[] = []): Map<string, number> {
  const scores = new Map<string, number>()
  lists.forEach((list, i) => list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + (weights[i] ?? 1) / (RRF_K + rank + 1))))
  return scores
}

const topIds = (scores: Map<string, number>, limit: number) =>
  [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)

const unique = (ids: string[]) => [...new Set(ids)]

// Thân nguồn tài liệu: mô tả + các đoạn (kèm tiêu đề mục), chia đều ngân sách ký tự ⇒ đoạn lời giải đi sau không bị cắt mất
function excerptBody(description: string, parts: { heading: string | null; text: string }[], budget: number): string {
  const head = description ? `${description}\n\n` : ''
  const per = Math.max(200, Math.floor((budget - head.length) / Math.max(parts.length, 1)))
  return clip(head + parts.map((p) => clip(p.heading ? `[${p.heading}]\n${p.text}` : p.text, per)).join('\n…\n'), budget)
}
// Đề thi: đoạn đã chọn thuộc "Câu N" ⇒ thêm đoạn phía bên kia (đề bài ↔ lời giải / đáp án) cùng số câu (alias d = tài liệu, $2 = đoạn đã chọn)
const SOLUTION_RE = `'lời giải|đáp án|hướng dẫn giải'`
const EXAM_COMPANION_SQL = `
  SELECT DISTINCT ON (b.id) o.id FROM document_chunks b JOIN document_chunks o ON o.document_id = b.document_id AND o.id <> b.id
  WHERE b.id = ANY($2::uuid[]) AND b.document_id = d.id AND d.doc_type IN ('midterm_exam', 'final_exam')
    AND substring(lower(b.heading) from 'câu\\s*(\\d+)') = substring(lower(o.heading) from 'câu\\s*(\\d+)')
    AND (lower(b.heading) ~ ${SOLUTION_RE}) <> (lower(o.heading) ~ ${SOLUTION_RE})
  ORDER BY b.id, o.chunk_index`
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

// Tìm kết hợp cho N7AI: full-text (đúng mã môn, công thức, tên riêng) + vector (đúng ý dù khác chữ / khác ngôn ngữ), gộp RRF
// Bài viết: cả bài; tài liệu: đoạn nội dung khớp nhất (document_chunks) thay vì chỉ tiêu đề / mô tả
@Injectable()
export class RagSearchService {
  constructor(
    private readonly db: DatabaseService,
    private readonly embedding: EmbeddingService
  ) {}

  async prepare(question: string, tsquery: string): Promise<RagQuery> {
    return { tsquery, vector: await this.embedding.embedQuery(question) }
  }

  // Hybrid có vector ⇒ ứng viên full-text phải đủ gần câu hỏi ($3 vector, $4 model); full-text khớp ≥ 2 từ rất nhiễu
  // (eval: câu hỏi lạc đề vẫn ra hàng chục nguồn). Nguồn chưa có embedding thì giữ nguyên
  private gate(q: RagQuery, mode: RagMode): unknown[] | null {
    return mode === 'hybrid' && q.vector ? [toVectorLiteral(q.vector), this.embedding.model] : null
  }

  // Bài viết công khai (+ của mình), chưa bị ẩn; kèm lời giải đã duyệt
  async posts(q: RagQuery, userId: string, opts: SearchOpts): Promise<Source[]> {
    const mode = opts.mode ?? 'hybrid'
    const gate = this.gate(q, mode)
    const [fts, vec] = await Promise.all([
      mode !== 'vector' && q.tsquery
        ? this.ids(
            `WITH q AS (SELECT to_tsquery('simple', $1) AS tsq)
             SELECT p.id FROM posts p, q
             WHERE p.search_tsv @@ q.tsq AND p.hidden_at IS NULL AND (p.visibility = 'public' OR p.author_id = $2)
               ${gate ? `AND NOT EXISTS (SELECT 1 FROM post_embeddings e WHERE e.post_id = p.id AND e.model = $4 AND 1 - (e.embedding <=> $3::vector) < ${MIN_SIMILARITY})` : ''}
             ORDER BY ts_rank(p.search_tsv, q.tsq) DESC LIMIT ${CANDIDATES}`,
            [q.tsquery, userId, ...(gate ?? [])]
          )
        : [],
      mode !== 'fulltext' && q.vector
        ? this.nearest(
            `SELECT p.id, 1 - (e.embedding <=> $1::vector) AS sim
             FROM post_embeddings e JOIN posts p ON p.id = e.post_id
             WHERE e.model = $3 AND p.hidden_at IS NULL AND (p.visibility = 'public' OR p.author_id = $2)
             ORDER BY e.embedding <=> $1::vector LIMIT ${CANDIDATES}`,
            [toVectorLiteral(q.vector), userId, this.embedding.model]
          )
        : []
    ])
    const ids = topIds(fuseRankings([fts, vec.map((r) => r.id)], [FULLTEXT_WEIGHT, 1]), opts.limit)
    if (!ids.length) return []
    const rows = (
      await this.db.query(
        `SELECT p.id, COALESCE(NULLIF(p.title, ''), left(p.content, 80)) AS title, left(p.content, $2) AS body,
                (SELECT left(c.content, 1000) FROM comments c WHERE c.post_id = p.id AND c.is_solution LIMIT 1) AS solution
         FROM posts p WHERE p.id = ANY($1::uuid[])`,
        [ids, opts.bodyChars]
      )
    ).rows
    const byId = new Map(rows.map((r) => [r.id, r]))
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => ({
        type: 'post' as const,
        id: r.id,
        title: r.title,
        body: r.solution ? `${r.body}\n\n[Lời giải đã được tác giả duyệt]\n${r.solution}` : r.body
      }))
  }

  // Tài liệu: xếp theo tài liệu (gộp đoạn khớp full-text, đoạn gần vector, tiêu đề/mô tả khớp), thân = đoạn khớp nhất
  // ownerOnly: connector "Tài liệu của tôi" (kể cả riêng tư); ngược lại tài liệu công khai + của mình
  async documents(q: RagQuery, userId: string, opts: SearchOpts & { ownerOnly?: boolean }): Promise<Source[]> {
    const mode = opts.mode ?? 'hybrid'
    const visible = opts.ownerOnly ? 'd.owner_id = $2' : `(d.visibility = 'public' OR d.owner_id = $2)`
    const gate = this.gate(q, mode)
    const embedded = `SELECT 1 FROM document_chunks g WHERE g.document_id = d.id AND g.embedding_model = $4`
    const [chunkFts, docFts, chunkVec] = await Promise.all([
      mode !== 'vector' && q.tsquery
        ? this.rows(
            `WITH q AS (SELECT to_tsquery('simple', $1) AS tsq)
             SELECT c.id, c.document_id AS doc FROM document_chunks c JOIN documents d ON d.id = c.document_id, q
             WHERE c.search_tsv @@ q.tsq AND ${visible}
               ${gate ? `AND (c.embedding_model IS DISTINCT FROM $4 OR 1 - (c.embedding <=> $3::vector) >= ${MIN_SIMILARITY})` : ''}
             ORDER BY ts_rank(c.search_tsv, q.tsq) DESC LIMIT ${CANDIDATES}`,
            [q.tsquery, userId, ...(gate ?? [])]
          )
        : [],
      mode !== 'vector' && q.tsquery
        ? this.ids(
            `WITH q AS (SELECT to_tsquery('simple', $1) AS tsq)
             SELECT d.id FROM documents d, q WHERE d.search_tsv @@ q.tsq AND ${visible}
               ${gate ? `AND (NOT EXISTS (${embedded}) OR EXISTS (${embedded} AND 1 - (g.embedding <=> $3::vector) >= ${MIN_SIMILARITY}))` : ''}
             ORDER BY ts_rank(d.search_tsv, q.tsq) DESC LIMIT ${DOC_LEVEL_CANDIDATES}`,
            [q.tsquery, userId, ...(gate ?? [])]
          )
        : [],
      mode !== 'fulltext' && q.vector
        ? this.nearest(
            `SELECT c.id, c.document_id AS doc, 1 - (c.embedding <=> $1::vector) AS sim
             FROM document_chunks c JOIN documents d ON d.id = c.document_id
             WHERE c.embedding_model = $3 AND ${visible}
             ORDER BY c.embedding <=> $1::vector LIMIT ${CANDIDATES}`,
            [toVectorLiteral(q.vector), userId, this.embedding.model]
          )
        : []
    ])

    // Lấy dư rồi gộp tài liệu trùng tệp (cùng content_hash) ⇒ không trả 2 nguồn giống nhau
    const ranked = topIds(
      fuseRankings([unique(chunkFts.map((r) => r.doc)), docFts, unique(chunkVec.map((r) => r.doc))], [FULLTEXT_WEIGHT, FULLTEXT_WEIGHT, 1]),
      opts.limit * 2
    )
    if (!ranked.length) return []
    // Đoạn tốt nhất của từng tài liệu theo điểm gộp ở mức đoạn
    const chunkScores = fuseRankings([chunkFts.map((r) => r.id), chunkVec.map((r) => r.id)], [FULLTEXT_WEIGHT, 1])
    const docOf = new Map([...chunkFts, ...chunkVec].map((r) => [r.id, r.doc as string]))
    const bestChunks = new Map<string, string[]>()
    for (const id of topIds(chunkScores, chunkScores.size)) {
      const doc = docOf.get(id)!
      const list = bestChunks.get(doc) ?? []
      if (list.length < CHUNKS_PER_DOC) bestChunks.set(doc, [...list, id])
    }
    const picked = [...bestChunks.values()].flat()

    // Đoạn kèm theo: tài liệu không có đoạn khớp ⇒ đoạn đầu; đề thi ⇒ đoạn đề ↔ lời giải cùng số câu
    const rows = (
      await this.db.query(
        `SELECT d.id, d.title, d.content_hash, left(COALESCE(d.description, ''), 200) AS description,
                (SELECT json_agg(json_build_object('heading', x.heading, 'text', x.content_text) ORDER BY x.chunk_index)
                 FROM (SELECT c.chunk_index, c.heading, c.content_text FROM document_chunks c
                       WHERE c.document_id = d.id AND (c.id = ANY($2::uuid[]) OR c.id IN (${EXAM_COMPANION_SQL}))
                       UNION
                       SELECT c.chunk_index, c.heading, c.content_text FROM document_chunks c
                       WHERE c.document_id = d.id AND NOT EXISTS (SELECT 1 FROM document_chunks k WHERE k.document_id = d.id AND k.id = ANY($2::uuid[]))
                         AND c.chunk_index = 0) x) AS excerpt
         FROM documents d WHERE d.id = ANY($1::uuid[])`,
        [ranked, picked]
      )
    ).rows
    const byId = new Map(rows.map((r) => [r.id, r]))
    const seen = new Set<string>()
    return ranked
      .map((id) => byId.get(id))
      .filter((r) => r && (!r.content_hash || (!seen.has(r.content_hash) && seen.add(r.content_hash))))
      .slice(0, opts.limit)
      .map((r) => ({
        type: 'document' as const,
        id: r.id,
        title: r.title,
        body: excerptBody(r.description, r.excerpt ?? [], opts.bodyChars)
      }))
  }

  private async ids(sql: string, params: unknown[]): Promise<string[]> {
    return (await this.db.query(sql, params)).rows.map((r) => r.id)
  }

  private async rows(sql: string, params: unknown[]): Promise<{ id: string; doc: string }[]> {
    return (await this.db.query(sql, params)).rows
  }

  // Láng giềng gần nhất qua HNSW; iterative scan ⇒ vẫn đủ kết quả khi bộ lọc quyền xem loại bớt; bỏ kết quả dưới ngưỡng
  private async nearest(sql: string, params: unknown[]): Promise<{ id: string; doc?: string; sim: number }[]> {
    const rows = await this.db.transaction(async (client) => {
      await client.query(`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`)
      return (await client.query(`SELECT * FROM (${sql}) n ORDER BY n.sim DESC`, params)).rows
    })
    return rows.filter((r) => r.sim >= MIN_SIMILARITY)
  }
}
