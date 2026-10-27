-- ==========================================================
-- Migration: Kho tài liệu — đính kèm bài viết thành tài liệu thật (idempotent)
-- documents: bản nháp (đang soạn bài) → published; listed = có trong kho môn học (đủ môn + loại)
-- post_documents thay cột URL posts.attached_document_ids (giữ cột cho dữ liệu cũ / client cũ)
-- Thiết kế: docs/core/25-document-library.md
-- ==========================================================

ALTER TYPE doc_type_enum ADD VALUE IF NOT EXISTS 'textbook';
ALTER TYPE doc_type_enum ADD VALUE IF NOT EXISTS 'exercise';
ALTER TYPE doc_type_enum ADD VALUE IF NOT EXISTS 'other';

ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'published';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS listed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT;               -- sha256 byte tệp ⇒ phát hiện trùng
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);    -- vd "2025-2026"
ALTER TABLE documents ADD COLUMN IF NOT EXISTS save_count INT NOT NULL DEFAULT 0;
-- doc_type = phân loại nội dung: NULL = chưa phân loại (trước đây mặc định lecture_slide)
ALTER TABLE documents ALTER COLUMN doc_type DROP DEFAULT;

DO $$ BEGIN
    ALTER TABLE documents ADD CONSTRAINT chk_documents_status CHECK (status IN ('draft', 'published'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_listed ON documents(course_id, doc_type, created_at DESC) WHERE listed;
CREATE INDEX IF NOT EXISTS idx_documents_drafts ON documents(created_at) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_documents (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_post_documents_doc ON post_documents(document_id);

CREATE TABLE IF NOT EXISTS migration_marks (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Một lần: tài liệu cũ có môn ⇒ vào kho; URL đính kèm bài cũ ⇒ tài liệu thật (chưa phân loại, không vào kho)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_marks WHERE name = 'documents-library-backfill') THEN
        RETURN;
    END IF;

    UPDATE documents SET listed = TRUE
     WHERE course_id IS NOT NULL AND visibility = 'public' AND status = 'published' AND doc_type IS NOT NULL;

    WITH att AS (
        SELECT p.id AS post_id, p.author_id, p.visibility, a.url, a.pos
          FROM posts p, unnest(p.attached_document_ids) WITH ORDINALITY AS a(url, pos)
         WHERE a.url ~ '^https?://'
    ), named AS (
        SELECT att.*,
               regexp_replace(regexp_replace(att.url, '^.*/', ''), '^[0-9]+_[a-z0-9]{6}_', '') AS fname
          FROM att
    ), ins AS (
        INSERT INTO documents (owner_id, title, original_name, file_url, file_size, mime_type, type, visibility, status, listed)
        SELECT DISTINCT ON (n.author_id, n.url) n.author_id, left(n.fname, 255), left(n.fname, 255), n.url, 0,
               CASE lower(substring(n.fname FROM '\.([A-Za-z0-9]+)$'))
                    WHEN 'pdf' THEN 'application/pdf'
                    WHEN 'doc' THEN 'application/msword'
                    WHEN 'docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    WHEN 'ppt' THEN 'application/vnd.ms-powerpoint'
                    WHEN 'pptx' THEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                    WHEN 'xls' THEN 'application/vnd.ms-excel'
                    WHEN 'xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    WHEN 'zip' THEN 'application/zip'
                    ELSE 'text/plain' END,
               CASE lower(substring(n.fname FROM '\.([A-Za-z0-9]+)$'))
                    WHEN 'pdf' THEN 'pdf' WHEN 'doc' THEN 'doc' WHEN 'docx' THEN 'doc'
                    WHEN 'ppt' THEN 'slides' WHEN 'pptx' THEN 'slides' WHEN 'xls' THEN 'sheet' WHEN 'xlsx' THEN 'sheet'
                    WHEN 'md' THEN 'markdown' ELSE 'other' END,
               CASE WHEN n.visibility = 'public' THEN 'public' ELSE 'private' END,
               'published', FALSE
          FROM named n
        RETURNING id, file_url, owner_id
    )
    INSERT INTO post_documents (post_id, document_id, position)
    SELECT DISTINCT ON (n.post_id, ins.id) n.post_id, ins.id, (n.pos - 1)::smallint
      FROM named n JOIN ins ON ins.file_url = n.url AND ins.owner_id = n.author_id
    ON CONFLICT DO NOTHING;

    INSERT INTO migration_marks (name) VALUES ('documents-library-backfill');
END $$;
