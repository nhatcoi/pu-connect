-- ============================================================================
-- RAG: nội dung tài liệu cắt đoạn (document_chunks) + embedding bài viết (pgvector)
-- Tìm kết hợp full-text (tsvector) + vector (cosine) cho N7AI — docs/core/17-rag-hybrid-search.md
-- Idempotent: an toàn chạy lại mỗi lần deploy
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- document_chunks (schema.sql) từng khai báo vector(1536), chưa bao giờ có dữ liệu ⇒ đổi về 1024 chiều (qwen3-embedding)
DO $$
BEGIN
  IF (SELECT atttypmod FROM pg_attribute WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding') <> 1024 THEN
    ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1024) USING NULL;
  END IF;
END $$;

-- Model đã tạo embedding: đổi EMBED_MODEL ⇒ worker tự tính lại
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', immutable_unaccent(content_text))) STORED;
CREATE INDEX IF NOT EXISTS idx_document_chunks_search ON document_chunks USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- Trạng thái trích nội dung tệp: pending → indexing (worker đang giữ) → indexed | empty (không có lớp chữ) | unsupported | failed (sau 3 lần lỗi)
-- index_updated_at: lần đổi trạng thái gần nhất (hạn giữ của indexing, giãn cách thử lại của pending)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS index_status VARCHAR(12) NOT NULL DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS index_attempts SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS index_updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_documents_index_queue ON documents (created_at) WHERE index_status IN ('pending', 'indexing');

-- Embedding bài viết (tiêu đề + nội dung + lời giải đã duyệt); source_hash lệch ⇒ bài đã sửa ⇒ tính lại
CREATE TABLE IF NOT EXISTS post_embeddings (
  post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  embedding vector(1024) NOT NULL,
  model TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_embeddings_hnsw ON post_embeddings USING hnsw (embedding vector_cosine_ops);
