-- ==========================================================
-- Migration: Lượt xem trang cá nhân (idempotent, chạy mỗi lần deploy)
-- Chỉ admin xem được (ghi audit). Gộp theo giờ: 1 dòng / (hồ sơ, người xem, giờ). Giữ 90 ngày.
-- ==========================================================
CREATE TABLE IF NOT EXISTS profile_views (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_hour TIMESTAMP NOT NULL,          -- date_trunc('hour', UTC)
    views INT NOT NULL DEFAULT 1,
    first_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, viewer_id, viewed_hour)
);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON profile_views (profile_id, last_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views (viewer_id, last_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_last ON profile_views (last_at);

-- Danh sách hoạt động theo người trong hồ sơ admin
CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON post_reactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_user ON study_group_members (user_id);
