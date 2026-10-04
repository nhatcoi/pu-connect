-- ==========================================================
-- Migration: Web Push (idempotent, chạy mỗi lần deploy)
-- Thiết kế: docs/core/05-notifications-and-realtime.md (mục 7)
-- ==========================================================

-- 1. Đăng ký push của từng trình duyệt (PushSubscription)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,          -- URL của push service (FCM / Mozilla / Apple)
    p256dh VARCHAR(255) NOT NULL,           -- khóa công khai của trình duyệt (mã hóa payload)
    auth VARCHAR(255) NOT NULL,             -- secret xác thực payload
    user_agent VARCHAR(300),
    failure_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- 2. Thời điểm đã gửi push cho thông báo (quan sát / chống gửi trùng)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- 3. Đếm push đã gửi gần đây (chống spam theo giờ)
CREATE INDEX IF NOT EXISTS idx_notifications_push_sent
  ON notifications(recipient_id, push_sent_at) WHERE push_sent_at IS NOT NULL;
