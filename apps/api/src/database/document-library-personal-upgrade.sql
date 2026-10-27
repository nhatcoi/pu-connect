-- ==========================================================
-- Migration: Kho tài liệu đợt 3 — kho cá nhân + tài liệu trong bình luận (idempotent)
-- library_items chỉ là tham chiếu: tài liệu gốc bị xóa / chuyển riêng tư ⇒ biến mất khỏi kho người khác
-- Thiết kế: docs/core/25-document-library.md
-- ==========================================================

CREATE TABLE IF NOT EXISTS library_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_folders_name ON library_folders(owner_id, lower(name));

CREATE TABLE IF NOT EXISTS library_items (
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES library_folders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_library_items_owner ON library_items(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_folder ON library_items(folder_id) WHERE folder_id IS NOT NULL;

-- documents.save_count = số người lưu (trừ chính chủ) — giữ đồng bộ bằng trigger
CREATE OR REPLACE FUNCTION library_items_save_count() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE documents SET save_count = save_count + 1 WHERE id = NEW.document_id AND owner_id <> NEW.owner_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE documents SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.document_id AND owner_id <> OLD.owner_id;
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_library_items_save_count ON library_items;
CREATE TRIGGER trg_library_items_save_count AFTER INSERT OR DELETE ON library_items
    FOR EACH ROW EXECUTE FUNCTION library_items_save_count();

CREATE TABLE IF NOT EXISTS comment_documents (
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (comment_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_documents_doc ON comment_documents(document_id);

-- Trang "Tài liệu": lọc theo loại / sắp xếp lượt tải trong kho
CREATE INDEX IF NOT EXISTS idx_documents_listed_popular ON documents(download_count DESC, created_at DESC) WHERE listed;
