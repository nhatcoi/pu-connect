-- Từ cấm do admin quản lý (bổ sung từ điển có sẵn trong code của kiểm duyệt tự động). Idempotent.
CREATE TABLE IF NOT EXISTS moderation_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term VARCHAR(80) NOT NULL,
    severity VARCHAR(10) NOT NULL DEFAULT 'medium',   -- heavy (chặn) | medium | light (gắn cờ)
    note VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Không phân biệt hoa thường
CREATE UNIQUE INDEX IF NOT EXISTS uq_moderation_terms_term ON moderation_terms (lower(term));
