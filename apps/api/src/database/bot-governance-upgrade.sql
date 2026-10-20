-- Bot governance: hồ sơ quyền riêng từng bot, chủ đề được phép, AI duyệt dữ liệu crawl.
-- Idempotent — chạy lại an toàn.

-- Chủ đề bot được phép đăng / tương tác (admin quản lý)
CREATE TABLE IF NOT EXISTS bot_topics (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  label TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO bot_topics (slug, label, keywords) VALUES
  ('hoc-tap', 'Học tập & môn học', ARRAY['học phần', 'môn học', 'bài tập', 'đề thi', 'ôn thi', 'lịch thi', 'điểm', 'tín chỉ', 'đồ án', 'giáo trình']),
  ('cntt', 'Công nghệ thông tin & lập trình', ARRAY['lập trình', 'code', 'python', 'java', 'javascript', 'sql', 'database', 'cơ sở dữ liệu', 'thuật toán', 'cấu trúc dữ liệu', 'git', 'docker', 'web', 'api', 'backend', 'frontend', 'phần mềm', 'kiểm thử', 'trí tuệ nhân tạo', 'machine learning', 'an toàn thông tin', 'mạng máy tính']),
  ('nckh', 'Nghiên cứu khoa học', ARRAY['nghiên cứu', 'nckh', 'paper', 'bài báo', 'hội thảo', 'luận văn', 'khóa luận']),
  ('thong-bao-truong', 'Thông báo & sự kiện của trường', ARRAY['thông báo', 'sự kiện', 'hội thảo', 'học bổng', 'lịch', 'đăng ký', 'phòng đào tạo', 'khoa', 'clb', 'câu lạc bộ']),
  ('thuc-tap-viec-lam', 'Thực tập & việc làm', ARRAY['thực tập', 'việc làm', 'tuyển dụng', 'cv', 'phỏng vấn', 'intern', 'fresher', 'kỹ năng'])
ON CONFLICT (slug) DO NOTHING;

-- Hồ sơ từng bot. Mặc định mọi quyền TẮT: admin bật từng việc cho từng bot.
CREATE TABLE IF NOT EXISTS bot_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  topics TEXT[] NOT NULL DEFAULT '{}',
  can_post BOOLEAN NOT NULL DEFAULT FALSE,
  can_comment BOOLEAN NOT NULL DEFAULT FALSE,
  can_like BOOLEAN NOT NULL DEFAULT FALSE,
  -- Được tương tác với bài của người thật (mặc định chỉ tương tác giữa các bot)
  interact_humans BOOLEAN NOT NULL DEFAULT FALSE,
  -- Là bot đăng bài từ dữ liệu crawl (thay phiên)
  feed_poster BOOLEAN NOT NULL DEFAULT FALSE,
  max_posts_per_day SMALLINT NOT NULL DEFAULT 1 CHECK (max_posts_per_day BETWEEN 0 AND 50),
  max_comments_per_day SMALLINT NOT NULL DEFAULT 3 CHECK (max_comments_per_day BETWEEN 0 AND 100),
  max_likes_per_day SMALLINT NOT NULL DEFAULT 5 CHECK (max_likes_per_day BETWEEN 0 AND 200),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO bot_profiles (user_id, feed_poster, topics)
SELECT u.id, u.username IN ('tranngocbot', 'tranminhbot'),
       CASE WHEN u.username IN ('tranngocbot', 'tranminhbot') THEN ARRAY['hoc-tap', 'thong-bao-truong', 'thuc-tap-viec-lam'] ELSE '{}' END
FROM users u WHERE u.is_bot
ON CONFLICT (user_id) DO NOTHING;

-- AI dùng để duyệt/viết lại dữ liệu crawl và sinh nội dung (key lấy từ env AI_API_KEY, không lưu DB)
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS ai_model TEXT NOT NULL DEFAULT 'v10';
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS ai_base_url TEXT;
-- Bật ⇒ bài AI đã duyệt vẫn chờ admin bấm Duyệt trước khi đăng
ALTER TABLE bot_control ADD COLUMN IF NOT EXISTS feed_review BOOLEAN NOT NULL DEFAULT FALSE;

-- Hàng đợi crawl: new → (AI) → approved | review | rejected → posted
ALTER TABLE bot_feed_items DROP CONSTRAINT IF EXISTS bot_feed_items_status_check;
ALTER TABLE bot_feed_items ADD COLUMN IF NOT EXISTS raw_content TEXT;
ALTER TABLE bot_feed_items ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE bot_feed_items ADD COLUMN IF NOT EXISTS verdict JSONB;
UPDATE bot_feed_items SET raw_content = content WHERE raw_content IS NULL;
-- Dữ liệu cũ (chưa qua AI) quay lại hàng chờ duyệt
UPDATE bot_feed_items SET status = 'new' WHERE status = 'pending';
ALTER TABLE bot_feed_items ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE bot_feed_items ADD CONSTRAINT bot_feed_items_status_check CHECK (status IN ('new', 'review', 'approved', 'rejected', 'posted', 'skipped'));
DROP INDEX IF EXISTS idx_bot_feed_items_pending;
CREATE INDEX IF NOT EXISTS idx_bot_feed_items_status ON bot_feed_items (status, id);
