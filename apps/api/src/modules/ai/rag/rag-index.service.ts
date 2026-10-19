import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../../database/database.service'
import { StorageService } from '../../storage/storage.service'
import { bufferToText, isExtractableMime } from '../doc-text'
import { EmbeddingService, toVectorLiteral } from './embedding.service'
import { chunkText } from './text-chunker'

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

// Văn bản đem đi embedding của bài viết (alias p); đổi công thức ⇒ source_hash đổi ⇒ worker tự tính lại
const POST_TEXT_SQL = `concat_ws(E'\\n\\n', NULLIF(p.title, ''), left(p.content, ${POST_CHARS}),
  (SELECT 'Lời giải: ' || left(c.content, ${SOLUTION_CHARS}) FROM comments c WHERE c.post_id = p.id AND c.is_solution LIMIT 1))`

export type SweepResult = { documents: number; chunks: number; posts: number }

// Worker RAG: (1) trích chữ tệp tài liệu → document_chunks; (2) embedding đoạn chưa có / model cũ; (3) embedding bài viết mới / đã sửa
// Không phụ thuộc server embedding ở bước (1): Mac mini tắt ⇒ full-text trên đoạn vẫn chạy, vector bù sau
@Injectable()
export class RagIndexService {
  private readonly logger = new Logger(RagIndexService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly embedding: EmbeddingService
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

  // Nhận vài tài liệu: đang chờ (đã qua thời gian giãn cách sau lần lỗi) hoặc worker trước giữ quá hạn (tiến trình chết giữa chừng)
  // SKIP LOCKED + chuyển sang 'indexing' ⇒ nhiều worker / lượt quét không làm trùng
  private async extractPending(): Promise<number> {
    const claimed = await this.db.query(
      `UPDATE documents d SET index_status = 'indexing', index_attempts = d.index_attempts + 1, index_updated_at = NOW()
       WHERE d.id IN (
         SELECT id FROM documents
         WHERE (index_status = 'pending' AND (index_updated_at IS NULL OR index_updated_at < NOW() - index_attempts * INTERVAL '${RETRY_DELAY_MIN} minutes'))
            OR (index_status = 'indexing' AND index_updated_at < NOW() - INTERVAL '${CLAIM_TIMEOUT_MIN} minutes')
         ORDER BY created_at LIMIT ${EXTRACT_BATCH} FOR UPDATE SKIP LOCKED)
       RETURNING d.id, d.title, d.file_url, d.mime_type, d.index_attempts`
    )
    for (const doc of claimed.rows) {
      try {
        await this.extract(doc)
      } catch (err: any) {
        const failed = doc.index_attempts >= MAX_ATTEMPTS
        await this.db.query(`UPDATE documents SET index_status = $2, index_updated_at = NOW() WHERE id = $1`, [doc.id, failed ? 'failed' : 'pending'])
        this.logger.warn(`Trích nội dung tài liệu ${doc.id} lỗi (lần ${doc.index_attempts}): ${err?.message}`)
      }
    }
    return claimed.rows.length
  }

  private async extract(doc: { id: string; file_url: string; mime_type: string }) {
    // Chỉ tải tệp trên R2 của mình (chặn SSRF qua file_url tùy ý)
    if (!isExtractableMime(doc.mime_type) || !doc.file_url.startsWith(this.storage.publicUrlFor('documents/'))) {
      await this.db.query(`UPDATE documents SET index_status = 'unsupported', index_updated_at = NOW() WHERE id = $1`, [doc.id])
      return
    }
    const res = await fetch(doc.file_url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_FILE_BYTES) throw new Error('Tệp quá lớn')
    const chunks = chunkText(await bufferToText(buf, doc.mime_type, MAX_PDF_PAGES))

    // ACID: thay toàn bộ đoạn cũ + đổi trạng thái cùng lúc
    await this.db.transaction(async (client) => {
      await client.query(`DELETE FROM document_chunks WHERE document_id = $1`, [doc.id])
      if (chunks.length) {
        await client.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content_text, token_count)
           SELECT $1, * FROM unnest($2::int[], $3::text[], $4::int[])`,
          [doc.id, chunks.map((c) => c.index), chunks.map((c) => c.text), chunks.map((c) => c.tokens)]
        )
      }
      await client.query(`UPDATE documents SET index_status = $2, index_updated_at = NOW() WHERE id = $1`, [doc.id, chunks.length ? 'indexed' : 'empty'])
    })
  }

  // Đoạn chưa có embedding (hoặc tạo bằng model khác); kèm tiêu đề tài liệu để đoạn có ngữ cảnh
  private async embedChunks(): Promise<number> {
    const rows = (
      await this.db.query(
        `SELECT c.id, d.title, c.content_text FROM document_chunks c JOIN documents d ON d.id = c.document_id
         WHERE c.embedding IS NULL OR c.embedding_model IS DISTINCT FROM $1
         ORDER BY c.document_id, c.chunk_index LIMIT ${EMBED_BATCH}`,
        [this.embedding.model]
      )
    ).rows
    if (!rows.length) return 0
    const vectors = await this.embedding.embedDocuments(rows.map((r) => `${r.title}\n\n${r.content_text}`))
    await this.db.query(
      `UPDATE document_chunks c SET embedding = v.embedding::vector, embedding_model = $3
       FROM unnest($1::uuid[], $2::text[]) AS v(id, embedding) WHERE c.id = v.id`,
      [rows.map((r) => r.id), vectors.map(toVectorLiteral), this.embedding.model]
    )
    return rows.length
  }

  // Bài viết chưa có embedding / đã sửa (hash lệch) / model khác
  private async embedPosts(): Promise<number> {
    const rows = (
      await this.db.query(
        `SELECT p.id, t.text, md5(t.text) AS hash
         FROM posts p CROSS JOIN LATERAL (SELECT ${POST_TEXT_SQL} AS text) t
         LEFT JOIN post_embeddings e ON e.post_id = p.id
         WHERE p.hidden_at IS NULL AND t.text <> '' AND (e.post_id IS NULL OR e.model <> $1 OR e.source_hash <> md5(t.text))
         ORDER BY p.created_at DESC LIMIT ${EMBED_BATCH}`,
        [this.embedding.model]
      )
    ).rows
    if (!rows.length) return 0
    const vectors = await this.embedding.embedDocuments(rows.map((r) => r.text))
    await this.db.query(
      `INSERT INTO post_embeddings (post_id, embedding, model, source_hash)
       SELECT v.id, v.embedding::vector, $3, v.hash FROM unnest($1::uuid[], $2::text[], $4::text[]) AS v(id, embedding, hash)
       ON CONFLICT (post_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
      [rows.map((r) => r.id), vectors.map(toVectorLiteral), this.embedding.model, rows.map((r) => r.hash)]
    )
    return rows.length
  }
}
