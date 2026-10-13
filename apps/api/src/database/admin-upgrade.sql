-- ==========================================================
-- Migration: Trang quản trị tối giản (idempotent, chạy mỗi lần deploy)
-- Ẩn bài vi phạm · xử lý báo cáo · khóa tài khoản · nhật ký thao tác admin
-- ==========================================================

-- 1. Bài bị admin ẩn: không hiện ở feed / cộng đồng / tìm kiếm (tác giả vẫn xem được)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_reason VARCHAR(255);

-- 2. Kết quả xử lý báo cáo: hidden (đã ẩn bài) | dismissed (bỏ qua)
ALTER TABLE post_reports ADD COLUMN IF NOT EXISTS resolution VARCHAR(20);
ALTER TABLE post_reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE post_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_post_reports_post_pending ON post_reports(post_id) WHERE status = 'pending';

-- 3. Khóa tài khoản: thời điểm + lý do (status = 'suspended' chặn đăng nhập)
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason VARCHAR(255);

-- 4. Nhật ký thao tác admin (chỉ thêm, không sửa/xóa)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,          -- post.hide | post.unhide | report.dismiss | user.suspend | user.unsuspend
    target_type VARCHAR(20) NOT NULL,     -- post | user
    target_id TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
