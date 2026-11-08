-- ==========================================================
-- Migration: Tính năng riêng của cộng đồng (idempotent)
-- Bài ghim · tài liệu của nhóm · chat nhóm · thông báo bài mới
-- ==========================================================

ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'community_post';

-- Thành viên bật/tắt thông báo bài mới của cộng đồng
ALTER TABLE community_members ADD COLUMN IF NOT EXISTS notify BOOLEAN NOT NULL DEFAULT TRUE;

-- Bài ghim (tối đa 3 bài/cộng đồng, kiểm ở tầng ứng dụng)
CREATE TABLE IF NOT EXISTS community_pins (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    pinned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (community_id, post_id)
);

-- Tài liệu chia sẻ trong cộng đồng: trỏ tới tài liệu có sẵn trong thư viện (không nhân đôi file)
CREATE TABLE IF NOT EXISTS community_documents (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (community_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_community_documents_added ON community_documents(community_id, added_at DESC);

-- Mỗi cộng đồng 1 nhóm chat (tạo lười khi thành viên mở lần đầu)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_community ON conversations(community_id) WHERE community_id IS NOT NULL;
