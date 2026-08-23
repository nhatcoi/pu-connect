-- High-Performance Indexes for PU Connector PostgreSQL

-- 1. GIN Indexes for Array matching (tags, interests, skills)
CREATE INDEX IF NOT EXISTS idx_posts_tags_gin ON posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_users_interests_gin ON users USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_users_skills_gin ON users USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_documents_tags_gin ON documents USING GIN (tags);

-- 2. B-Tree Indexes for Fast Filtering & Sorting
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_course_created ON posts (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_type_created ON posts (post_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned_created ON posts (is_pinned, created_at DESC);

-- 3. Comments Indexing
CREATE INDEX IF NOT EXISTS idx_comments_post_solution_created ON comments (post_id, is_solution DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);

-- 4. Social Graph & Reactions
CREATE INDEX IF NOT EXISTS idx_user_follows_graph ON user_follows (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_lookup ON post_reactions (post_id, user_id);
