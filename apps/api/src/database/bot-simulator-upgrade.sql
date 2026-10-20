-- Bot Simulator: điều khiển từ Admin (daemon đọc DB, không mở cổng mạng)
-- Idempotent — chạy lại an toàn.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_is_bot ON users (username) WHERE is_bot;

-- Trạng thái điều khiển: đúng 1 dòng. Mặc định TẮT để deploy không tự phát sinh nội dung.
CREATE TABLE IF NOT EXISTS bot_control (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  speed TEXT NOT NULL DEFAULT 'normal' CHECK (speed IN ('slow', 'normal', 'fast')),
  heartbeat_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO bot_control (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Hàng đợi lệnh thủ công từ admin; daemon nhận từng lệnh (FOR UPDATE SKIP LOCKED)
CREATE TABLE IF NOT EXISTS bot_commands (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('post', 'chat', 'group', 'comment')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  result TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bot_commands_pending ON bot_commands (id) WHERE status = 'pending';

-- Nhật ký hoạt động bot (giữ 7 ngày, daemon dọn)
CREATE TABLE IF NOT EXISTS bot_activity (
  id BIGSERIAL PRIMARY KEY,
  bot_username TEXT,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bot_activity_created ON bot_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_activity_bot ON bot_activity (bot_username, created_at DESC);
