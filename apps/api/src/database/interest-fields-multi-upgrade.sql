-- ==========================================================
-- Migration: Chọn nhiều lĩnh vực quan tâm (tối đa 3 — giới hạn do code kiểm tra) (idempotent)
-- user_interest_fields là nguồn đầy đủ; users.interest_field_id giữ lĩnh vực CHÍNH (position 0) cho huy hiệu tác giả,
-- bot và mọi chỗ chỉ cần một giá trị. Chạy sau units-simplify-upgrade.sql
-- ==========================================================

CREATE TABLE IF NOT EXISTS user_interest_fields (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES interest_fields(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_user_interest_fields_field ON user_interest_fields (field_id);

-- Lĩnh vực chính hiện có ⇒ dòng đầu tiên (bot / seed ghi thẳng users.interest_field_id cũng được nhặt lại ở mỗi lần deploy)
INSERT INTO user_interest_fields (user_id, field_id, position)
SELECT id, interest_field_id, 0 FROM users WHERE interest_field_id IS NOT NULL
ON CONFLICT DO NOTHING;
