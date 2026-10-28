-- ==========================================================
-- Migration: Cộng đồng tài liệu — đánh giá sao + bộ sưu tập tài liệu (idempotent)
-- ==========================================================

-- Đánh giá 1–5 sao, mỗi người 1 lượt/tài liệu; documents giữ sẵn trung bình + số lượt để danh sách không phải tính lại
ALTER TABLE documents ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS document_ratings (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, user_id)
);

-- Bộ sưu tập: người dùng gom tài liệu công khai thành bộ (vd. "Ôn thi Giải tích"), chia sẻ hoặc giữ riêng
CREATE TABLE IF NOT EXISTS document_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_collections_owner ON document_collections(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_collections_public ON document_collections(updated_at DESC) WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS document_collection_items (
    collection_id UUID NOT NULL REFERENCES document_collections(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_document_collection_items_doc ON document_collection_items(document_id);
