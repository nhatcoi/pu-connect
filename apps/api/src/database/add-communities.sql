-- ==========================================================
-- Migration: Add Sub-Communities (Diễn đàn & Cộng đồng sinh viên)
-- ==========================================================

-- 1. Communities Table
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    community_type VARCHAR(50) DEFAULT 'academic', -- 'campus', 'faculty', 'academic', 'life', 'club'
    avatar_url VARCHAR(500),
    banner_url VARCHAR(500),
    rules JSONB DEFAULT '[]',
    members_count INT DEFAULT 0,
    posts_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Community Members Table
CREATE TABLE IF NOT EXISTS community_members (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) DEFAULT 'member', -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

-- 3. Update Posts Table with community_id
ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_type ON communities(community_type);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_community ON posts(community_id, created_at DESC);

-- (Không seed nhóm mẫu: nhóm được tạo qua ứng dụng; seed cũ đã bị gỡ vì mỗi lần deploy lại sinh lại nhóm đã xóa.)
