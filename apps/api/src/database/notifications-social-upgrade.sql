-- ==========================================================
-- Migration: thông báo social mở rộng (idempotent)
-- Loại mới: comment_like (thích bình luận), followed_post (bài mới từ người đang theo dõi), group_member_joined (có người vào nhóm học của bạn)
-- Lưu ý: ALTER TYPE ... ADD VALUE không chạy trong transaction ⇒ psql -f (autocommit). Chạy sau notifications-upgrade.sql
-- ==========================================================
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'comment_like';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'followed_post';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'group_member_joined';
