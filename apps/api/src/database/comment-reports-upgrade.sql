-- Báo cáo vi phạm bình luận (hàng chờ kiểm duyệt gom cả bài lẫn bình luận). Idempotent.
CREATE TABLE IF NOT EXISTS comment_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolution VARCHAR(20),
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Một người chỉ có một báo cáo đang chờ cho mỗi bình luận
CREATE UNIQUE INDEX IF NOT EXISTS uq_comment_reports_pending
    ON comment_reports(comment_id, reporter_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON comment_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON comment_reports(comment_id);
