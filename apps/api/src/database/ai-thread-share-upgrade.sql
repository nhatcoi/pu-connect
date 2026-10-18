-- ==========================================================
-- Migration: Chia sẻ công khai hội thoại N7AI qua link (idempotent)
-- Thiết kế: docs/core/11-n7ai-space.md §Chia sẻ hội thoại
-- ==========================================================

-- Mỗi thread tối đa 1 link; ảnh chụp = các tin có id <= until_message_id (id tin tăng dần)
-- Xóa thread ⇒ link mất theo (cascade); ngắt chia sẻ = xóa hàng
CREATE TABLE IF NOT EXISTS ai_thread_shares (
    conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(32) NOT NULL UNIQUE,          -- 128-bit ngẫu nhiên, base64url
    until_message_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
