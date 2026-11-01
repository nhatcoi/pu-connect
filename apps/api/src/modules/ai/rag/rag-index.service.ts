import { createHash } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../database/database.service'
import { StorageService } from '../../storage/storage.service'
import { bufferToText, isExtractableMime, PDF_MIME, pdfPageTexts } from '../doc-text'
import { EmbeddingService, toVectorLiteral } from './embedding.service'
import { OcrRateLimitedError, OcrService } from './ocr.service'
import { cleanPages, isGarbled, needsOcr } from './text-cleaner'
import { chunkText, isTruncated } from './text-chunker'

// Phiên bản pipeline trích nội dung (làm sạch, cắt đoạn, OCR); nâng số ⇒ tài liệu đã index được làm lại
export const INDEX_VERSION = 2
const EXTRACT_BATCH = 4
const EMBED_BATCH = 64
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MIN = 5 // lần lỗi thứ n ⇒ thử lại sau n × 5 phút
const CLAIM_TIMEOUT_MIN = 15 // worker giữ quá 15 phút ⇒ coi như đã chết, nhận lại
const MAX_FILE_BYTES = 30 * 1024 * 1024
const MAX_PDF_PAGES = 150
const SWEEP_BUDGET_MS = 60_000 // 1 lượt worker: làm tới khi hết việc hoặc hết ngân sách thời gian
const POST_CHARS = 4000
const SOLUTION_CHARS = 1500
const DONE_STATUSES = `('indexed', 'partial', 'empty', 'garbled', 'unsupported')`

// Văn bản đem đi embedding của bài viết (alias p); đổi công thức ⇒ source_hash đổi ⇒ worker tự tính lại
const POST_TEXT_SQL = `concat_ws(E'\\n\\n', NULLIF(p.title, ''), left(p.content, ${POST_CHARS}),
  (SELECT 'Lời giải: ' || left(c.content, ${SOLUTION_CHARS}) FROM comments c WHERE c.post_id = p.id AND c.is_solution LIMIT 1))`
// Input embedding của đoạn (alias c, d): tiêu đề tài liệu › tiêu đề mục + nội dung
const CHUNK_TEXT_SQL = `concat_ws(' › ', d.title, NULLIF(c.heading, '')) || E'\\n\\n' || c.content_text`
// Cần (tính lại) embedding: chưa có / model khác / input đổi — trừ input đã biết là hỏng với model này (alias x = bảng, t = input)
const STALE_SQL = (model: string, hash: string, input: string) =>
  `(${model} IS DISTINCT FROM $1 OR ${hash} IS DISTINCT FROM md5(${input}))
   AND NOT (${model} IS NOT DISTINCT FROM 'error:' || $1 AND ${hash} IS NOT DISTINCT FROM md5(${input}))`

export type SweepResult = { documents: number; chunks: number; posts: number }
type ExtractResult = { status: 'indexed' | 'partial' | 'empty' | 'garbled'; text: string }

// Worker RAG: (1) trích chữ tệp tài liệu (làm sạch, OCR trang scan) → document_chunks; (2) embedding đoạn; (3) embedding bài viết
// Không phụ thuộc server embedding ở bước (1): Mac mini tắt ⇒ full-text trên đoạn vẫn chạy, vector bù sau
@Injectable()
export class RagIndexService {
  private readonly logger = new Logger(RagIndexService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly embedding: EmbeddingService,
    private readonly ocr: OcrService
  ) {}

  async sweep(): Promise<SweepResult> {
    const result: SweepResult = { documents: 0, chunks: 0, posts: 0 }
    const deadline = Date.now() + SWEEP_BUDGET_MS
    while (Date.now() < deadline) {
      const documents = await this.extractPending()
      const chunks = this.embedding.available ? await this.embedChunks() : 0
      const posts = this.embedding.available ? await this.embedPosts() : 0
      result.documents += documents
      result.chunks += chunks
      result.posts += posts
      if (!documents && !chunks && !posts) break
    }
    return result
  }

  // Nhận vài tài liệu: đang chờ (qua thời gian giãn cách sau lần lỗi), worker trước giữ quá hạn, rồi tài liệu index bằng pipeline cũ
  // SKIP LOCKED + chuyển sang 'indexing' ⇒ nhiều worker / lượt quét không làm trùng
  private async extractPending(): Promise<number> {
    const claimed = await this.db.query(
      `UPDATE documents d SET index_status = 'indexing', index_attempts = d.index_attempts + 1, index_updated_at = NOW()
       WHERE d.id IN (
         SELECT id FROM documents
         WHERE (index_status = 'pending' AND (index_updated_at IS NULL OR index_updated_at < NOW() - index_attempts * INTERVAL '${RETRY_DELAY_MIN} minutes'))
            OR (index_status = 'indexing' AND index_updated_at < NOW() - INTERVAL '${CLAIM_TIMEOUT_MIN} minutes')
            OR (index_status IN ${DONE_STATUSES} AND index_version < ${INDEX_VERSION})
         ORDER BY (index_status IN ${DONE_STATUSES}), created_at LIMIT ${EXTRACT_BATCH} FOR UPDATE SKIP LOCKED)
       RETURNING d.id, d.title, d.file_url, d.mime_type, d.index_attempts`
    )
    for (const doc of claimed.rows) {
      try {
        await this.extract(doc)
      } catch (err: any) {
        // Gateway OCR quá tải ⇒ không tính lần lỗi, thử lại ở lượt sau giãn cách
        const rateLimited = err instanceof OcrRateLimitedError
        const failed = !rateLimited && doc.index_attempts >= MAX_ATTEMPTS
        await this.db.query(`UPDATE documents SET index_status = $2, index_updated_at = NOW(), index_attempts = index_attempts - $3 WHERE id = $1`, [
          doc.id,
          failed ? 'failed' : 'pending',
          rateLimited ? 1 : 0
        ])
        this.logger.warn(`Trích nội dung tài liệu ${doc.id} lỗi (lần ${doc.index_attempts}): ${err?.message}`)
      }
    }
    return claimed.rows.length
  }

  private async extract(doc: { id: string; file_url: string; mime_type: string }) {
    // Chỉ tải tệp trên R2 của mình (chặn SSRF qua file_url tùy ý)
    if (!isExtractableMime(doc.mime_type) || !doc.file_url.startsWith(this.storage.publicUrlFor('documents/'))) {
      await this.finish(doc.id, 'unsupported', null)
      return
    }
    const res = await fetch(doc.file_url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_FILE_BYTES) throw new Error('Tệp quá lớn')

    const { status, text } = doc.mime_type === PDF_MIME ? await this.pdfText(buf) : this.plainText(await bufferToText(buf, doc.mime_type))
    const chunks = text ? chunkText(text) : []
    const finalStatus = !chunks.length ? (status === 'garbled' ? 'garbled' : 'empty') : isTruncated(chunks) ? 'partial' : status

    // ACID: thay toàn bộ đoạn cũ + đổi trạng thái cùng lúc
    await this.db.transaction(async (client) => {
      await client.query(`DELETE FROM document_chunks WHERE document_id = $1`, [doc.id])
      if (chunks.length) {
        await client.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content_text, token_count, heading)
           SELECT $1, * FROM unnest($2::int[], $3::text[], $4::int[], $5::text[])`,
          [doc.id, chunks.map((c) => c.index), chunks.map((c) => c.text), chunks.map((c) => c.tokens), chunks.map((c) => c.heading)]
        )
      }
      await this.finish(doc.id, finalStatus, createHash('sha256').update(buf).digest('hex'), client)
    })
  }

  private async finish(id: string, status: string, contentHash: string | null, client: { query: DatabaseService['query'] } = this.db) {
    await client.query(
      `UPDATE documents SET index_status = $2, index_version = ${INDEX_VERSION}, index_updated_at = NOW(), content_hash = COALESCE($3, content_hash) WHERE id = $1`,
      [id, status, contentHash]
    )
  }

  // PDF theo trang: trang không có lớp chữ (scan) / chữ rác (font cũ) ⇒ OCR (tối đa OCR_MAX_PAGES), rồi làm sạch
  private async pdfText(buf: Buffer): Promise<ExtractResult> {
    const { pages, total } = await pdfPageTexts(buf, MAX_PDF_PAGES)
    const ocrPages = pages.map((p, i) => (needsOcr(p) ? i + 1 : 0)).filter(Boolean)
    if (ocrPages.length && this.ocr.enabled) {
      const read = await this.ocr.pdfPages(buf, ocrPages.slice(0, this.ocr.maxPages))
      for (const [page, text] of read) pages[page - 1] = text
    }
    const text = cleanPages(pages.filter((p) => !needsOcr(p)))
    // Còn trang chưa đọc được: OCR tắt / vượt giới hạn trang OCR / OCR không ra chữ
    const skipped = pages.some((p) => needsOcr(p) && p.trim()) || (ocrPages.length > 0 && !this.ocr.enabled)
    if (!text) return { status: pages.some((p) => isGarbled(p)) ? 'garbled' : 'empty', text: '' }
    return { status: total > MAX_PDF_PAGES || skipped || ocrPages.length > this.ocr.maxPages ? 'partial' : 'indexed', text }
  }

  private plainText(raw: string): ExtractResult {
    if (isGarbled(raw)) return { status: 'garbled', text: '' }
    return { status: 'indexed', text: cleanPages([raw]) }
  }

  // Đoạn chưa có embedding / model khác / input đổi (đổi tiêu đề tài liệu); input hỏng ⇒ đánh dấu, không chặn cả lô
  private async embedChunks(): Promise<number> {
    await this.embedding.currentModel()
    const rows = (
      await this.db.query(
        `SELECT c.id, ${CHUNK_TEXT_SQL} AS text FROM document_chunks c JOIN documents d ON d.id = c.document_id
         WHERE ${STALE_SQL('c.embedding_model', 'c.source_hash', CHUNK_TEXT_SQL)}
         ORDER BY c.document_id, c.chunk_index LIMIT ${EMBED_BATCH}`,
        [this.embedding.model]
      )
    ).rows
    if (!rows.length) return 0
    const vectors = await this.embedding.embedEach(rows.map((r) => r.text))
    await this.db.query(
      `UPDATE document_chunks c SET embedding = v.embedding::vector, source_hash = md5(v.text),
              embedding_model = CASE WHEN v.embedding IS NULL THEN 'error:' || $3 ELSE $3 END
       FROM unnest($1::uuid[], $2::text[], $4::text[]) AS v(id, embedding, text) WHERE c.id = v.id`,
      [rows.map((r) => r.id), vectors.map((v) => (v ? toVectorLiteral(v) : null)), this.embedding.model, rows.map((r) => r.text)]
    )
    this.warnRejected(vectors, 'đoạn tài liệu')
    return rows.length
  }

  // Bài viết chưa có embedding / đã sửa (hash lệch) / model khác
  private async embedPosts(): Promise<number> {
    await this.embedding.currentModel()
    const rows = (
      await this.db.query(
        `SELECT p.id, t.text, md5(t.text) AS hash
         FROM posts p CROSS JOIN LATERAL (SELECT ${POST_TEXT_SQL} AS text) t
         LEFT JOIN post_embeddings e ON e.post_id = p.id
         WHERE p.hidden_at IS NULL AND t.text <> '' AND (e.post_id IS NULL OR (${STALE_SQL('e.model', 'e.source_hash', 't.text')}))
         ORDER BY p.created_at DESC LIMIT ${EMBED_BATCH}`,
        [this.embedding.model]
      )
    ).rows
    if (!rows.length) return 0
    const vectors = await this.embedding.embedEach(rows.map((r) => r.text))
    await this.db.query(
      `INSERT INTO post_embeddings (post_id, embedding, model, source_hash)
       SELECT v.id, v.embedding::vector, CASE WHEN v.embedding IS NULL THEN 'error:' || $3 ELSE $3 END, v.hash
       FROM unnest($1::uuid[], $2::text[], $4::text[]) AS v(id, embedding, hash)
       ON CONFLICT (post_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
      [rows.map((r) => r.id), vectors.map((v) => (v ? toVectorLiteral(v) : null)), this.embedding.model, rows.map((r) => r.hash)]
    )
    this.warnRejected(vectors, 'bài viết')
    return rows.length
  }

  private warnRejected(vectors: (number[] | null)[], what: string) {
    const rejected = vectors.filter((v) => !v).length
    if (rejected) this.logger.warn(`Server embedding từ chối ${rejected} ${what} (đánh dấu lỗi, bỏ qua tới khi nội dung đổi)`)
  }
}
