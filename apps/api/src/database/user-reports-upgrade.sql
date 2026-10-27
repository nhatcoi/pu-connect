-- Báo cáo người dùng (hồ sơ / hành vi), gom chung hàng chờ kiểm duyệt. Idempotent.
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolution VARCHAR(20),
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reports_pending ON user_reports(reported_id, reporter_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status, created_at DESC);
