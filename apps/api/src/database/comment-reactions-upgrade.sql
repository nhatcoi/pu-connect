-- ==========================================================
-- Like bình luận: bảng riêng (trước đây ghi nhầm vào post_reactions ⇒ vi phạm FK posts)
-- Comment likes get their own table (post_reactions.post_id references posts)
-- Idempotent
-- ==========================================================

CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

-- "Bình luận mình đã thích" (tab hoạt động) / per-user lookups
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON comment_reactions (user_id, created_at DESC);
