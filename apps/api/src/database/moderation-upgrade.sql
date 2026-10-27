-- Nhật ký kiểm duyệt tự động (tầng 1 từ cấm + tầng 2 model). Idempotent.
-- block: nội dung bị chặn, không tạo bài ⇒ chỉ có bản ghi ở đây (content). hold: bài bị ẩn qua posts.hidden_at.
CREATE TABLE IF NOT EXISTS moderation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    surface VARCHAR(20) NOT NULL,            -- post | comment
    action VARCHAR(10) NOT NULL,             -- flag | hold | block
    tier SMALLINT,                           -- 1 = luật, 2 = model
    reason VARCHAR(40),
    scores JSONB,                            -- {clean, offense, hate}
    matched_terms TEXT[] NOT NULL DEFAULT '{}',
    content TEXT NOT NULL,                   -- cắt tối đa 2000 ký tự
    enforced BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = chế độ shadow (chỉ ghi log)
    target_type VARCHAR(20),
    target_id UUID,
    review_status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | confirmed | dismissed
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_queue ON moderation_events(review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_events_user ON moderation_events(user_id, created_at DESC);
