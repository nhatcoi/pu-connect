-- ==========================================================
-- Migration: Chế tài theo bậc (idempotent, chạy mỗi lần deploy)
-- Cảnh cáo → Hạn chế (chỉ đọc) có thời hạn → Khóa có thời hạn → Khóa vĩnh viễn
-- ==========================================================

-- 1. Khóa có thời hạn (NULL = vĩnh viễn) + Hạn chế chỉ đọc
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_reason VARCHAR(255);

-- Job gỡ chế tài hết hạn quét theo 2 index nhỏ (partial)
CREATE INDEX IF NOT EXISTS idx_users_suspended_until ON users (suspended_until) WHERE status = 'suspended' AND suspended_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_restricted ON users (restricted_until) WHERE restricted_at IS NOT NULL;

-- 2. Lịch sử chế tài (đếm "lần vi phạm" để đề xuất bậc tiếp theo)
CREATE TABLE IF NOT EXISTS user_sanctions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('warning', 'restrict', 'suspend')),
    reason VARCHAR(255),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,                 -- NULL: cảnh cáo hoặc vĩnh viễn
    revoked_at TIMESTAMPTZ,              -- gỡ sớm / hủy do nhầm (không tính là vi phạm)
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sanctions_user ON user_sanctions (user_id, created_at DESC);

-- 3. Loại thông báo cho cảnh cáo / hạn chế / khóa
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'account_notice';
