-- ==========================================================
-- Migration: Quản lý người dùng nâng cao (idempotent, chạy mỗi lần deploy)
-- Phân trang server · sắp xếp · bộ lọc · thao tác hàng loạt · ghi chú nội bộ
-- ==========================================================

-- 1. Sắp xếp / lọc danh sách người dùng (B-Tree)
CREATE INDEX IF NOT EXISTS idx_users_human_created ON users (created_at DESC) WHERE account_type = 'human';
CREATE INDEX IF NOT EXISTS idx_users_human_last_seen ON users (last_seen_at DESC NULLS LAST) WHERE account_type = 'human';
CREATE INDEX IF NOT EXISTS idx_users_human_reputation ON users (reputation_points DESC) WHERE account_type = 'human';
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users (suspended_at DESC) WHERE status = 'suspended';

-- 2. Tìm kiếm email / mã SV không dấu (trigram; tên + username đã có idx_users_name_trgm)
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (lower(email) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_student_id_trgm ON users USING gin (lower(student_id) gin_trgm_ops) WHERE student_id IS NOT NULL;

-- 3. Đếm hoạt động theo người (cột Bình luận / Báo cáo đã gửi trong hồ sơ)
CREATE INDEX IF NOT EXISTS idx_comments_author_created ON comments (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reports_reporter ON post_reports (reporter_id);

-- 4. Thu hồi phiên theo user (trước: quét toàn bảng user_sessions)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions ((sess::jsonb #>> '{passport,user,id}'));

-- 5. Lịch sử kiểm duyệt theo đối tượng (tab Kiểm duyệt trong hồ sơ người dùng)
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_logs (target_type, target_id, created_at DESC);

-- 6. Ghi chú nội bộ của quản trị viên về 1 người dùng (người dùng không thấy)
CREATE TABLE IF NOT EXISTS admin_user_notes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    body VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user ON admin_user_notes (user_id, created_at DESC);
