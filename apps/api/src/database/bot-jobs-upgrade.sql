-- Bot jobs: admin nhập bài đã sưu tầm (Excel/JSON) → job giao cho 1 bot đăng theo lịch, bot tự trả lời/thả tim bình luận ở bài nó quản lý.
-- Thay luồng bot_commands/bot_control/bot_topics cũ (bảng cũ giữ nguyên, không còn dùng). Idempotent — chạy lại an toàn.

CREATE TABLE IF NOT EXISTS bot_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  bot_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Bot tự trả lời bình luận / thả tim bình luận ở các bài của job
  auto_reply BOOLEAN NOT NULL DEFAULT FALSE,
  auto_react BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bot_jobs_bot ON bot_jobs (bot_id);

-- Mỗi dòng file = 1 bài. data = toàn bộ trường bài (title, content, postType, tags, mediaUrls, ...)
CREATE TABLE IF NOT EXISTS bot_job_posts (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES bot_jobs(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  content_hash CHAR(40) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posting', 'posted', 'failed')),
  error TEXT,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bot_job_posts_job ON bot_job_posts (job_id, id);
CREATE INDEX IF NOT EXISTS idx_bot_job_posts_due ON bot_job_posts (scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bot_job_posts_post ON bot_job_posts (post_id) WHERE post_id IS NOT NULL;
-- Không nhập trùng nội dung đã có (lỗi thì cho nhập lại)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_job_posts_hash ON bot_job_posts (content_hash) WHERE status <> 'failed';

-- Bình luận đã xử lý (mỗi bình luận chỉ trả lời/thả tim một lần)
CREATE TABLE IF NOT EXISTS bot_job_handled (
  comment_id UUID PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES bot_jobs(id) ON DELETE CASCADE,
  replied BOOLEAN NOT NULL DEFAULT FALSE,
  reacted BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  handled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bot_job_handled_job ON bot_job_handled (job_id);

-- Lệnh cũ đang chờ không còn ai chạy ⇒ hủy
UPDATE bot_commands SET status = 'cancelled', result = 'Hệ bot đã chuyển sang job', finished_at = NOW() WHERE status IN ('pending', 'running');
