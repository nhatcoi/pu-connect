-- ==========================================================
-- Migration: Thùng rác (xóa mềm) cho dữ liệu có giá trị (idempotent)
-- Mọi DELETE trên bảng được gắn trigger sẽ lưu bản sao dòng bị xóa vào deleted_records
-- (gồm cả dòng bị cascade) ⇒ truy vấn đọc hiện có giữ nguyên, khôi phục theo batch (1 giao dịch xóa)
-- ==========================================================

CREATE TABLE IF NOT EXISTS deleted_records (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    data JSONB NOT NULL,                  -- to_jsonb(OLD)
    batch BIGINT NOT NULL,                -- txid_current(): các dòng bị xóa cùng giao dịch (cha trước con)
    deleted_by UUID,                      -- app.user_id (nếu service gán), có thể NULL
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_batch ON deleted_records(batch, id);
CREATE INDEX IF NOT EXISTS idx_deleted_records_table ON deleted_records(table_name, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_records_at ON deleted_records(deleted_at);

CREATE OR REPLACE FUNCTION trash_row() RETURNS trigger AS $$
BEGIN
    INSERT INTO deleted_records (table_name, row_id, data, batch, deleted_by)
    VALUES (TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD), txid_current(), NULLIF(current_setting('app.user_id', true), '')::uuid);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['posts', 'comments', 'documents', 'study_sets', 'academic_units'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_trash_%1$s ON %1$s', t);
        EXECUTE format('CREATE TRIGGER trg_trash_%1$s BEFORE DELETE ON %1$s FOR EACH ROW EXECUTE FUNCTION trash_row()', t);
    END LOOP;
END $$;
