-- Dọn dữ liệu do Bot Simulator tạo trước khi có chính sách bot (2026-10-20).
-- Chạy: psql -v commit=false -f bot-cleanup.sql   (xem trước, tự ROLLBACK)
--       psql -v commit=true  -f bot-cleanup.sql   (áp dụng)
-- Mọi dòng bị xóa được lưu trong bảng archive_bot_cleanup_* để khôi phục khi cần.
--
-- Quy tắc:
--  • Xóa mọi bình luận và lượt tim của bot (bot chỉ tương tác lại khi admin cấp quyền).
--  • Xóa hội thoại chỉ có bot; GIỮ hội thoại có người thật.
--  • Xóa bài của bot chưa có người thật tương tác (bình luận/tim/lưu); GIỮ bài đã có người thật tương tác.
--  • Xóa thông báo do bot gây ra; tính lại bộ đếm like/comment của bài.
\set ON_ERROR_STOP on
BEGIN;

\echo === Trước khi dọn
SELECT (SELECT COUNT(*) FROM posts p JOIN users u ON u.id = p.author_id WHERE u.is_bot) AS bot_posts,
       (SELECT COUNT(*) FROM comments c JOIN users u ON u.id = c.author_id WHERE u.is_bot) AS bot_comments,
       (SELECT COUNT(*) FROM post_reactions r JOIN users u ON u.id = r.user_id WHERE u.is_bot) AS bot_reactions,
       (SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.actor_id WHERE u.is_bot) AS bot_notifications;

-- Bài bot không có người thật tương tác
CREATE TEMP TABLE _bot_posts_del ON COMMIT DROP AS
SELECT p.id FROM posts p JOIN users u ON u.id = p.author_id
WHERE u.is_bot
  AND NOT EXISTS (SELECT 1 FROM comments c JOIN users cu ON cu.id = c.author_id WHERE c.post_id = p.id AND NOT cu.is_bot)
  AND NOT EXISTS (SELECT 1 FROM post_reactions r JOIN users ru ON ru.id = r.user_id WHERE r.post_id = p.id AND NOT ru.is_bot)
  AND NOT EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id = p.id);

-- Hội thoại chỉ có bot
CREATE TEMP TABLE _bot_convs_del ON COMMIT DROP AS
SELECT c.id FROM conversations c
WHERE EXISTS (SELECT 1 FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id = c.id AND u.is_bot)
  AND NOT EXISTS (SELECT 1 FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id = c.id AND NOT u.is_bot);

-- Lưu trữ trước khi xóa
CREATE TABLE IF NOT EXISTS archive_bot_cleanup_posts AS SELECT * FROM posts WHERE false;
CREATE TABLE IF NOT EXISTS archive_bot_cleanup_comments AS SELECT * FROM comments WHERE false;
CREATE TABLE IF NOT EXISTS archive_bot_cleanup_reactions AS SELECT * FROM post_reactions WHERE false;
CREATE TABLE IF NOT EXISTS archive_bot_cleanup_conversations AS SELECT * FROM conversations WHERE false;
CREATE TABLE IF NOT EXISTS archive_bot_cleanup_messages AS SELECT * FROM messages WHERE false;
CREATE TABLE IF NOT EXISTS archive_bot_cleanup_notifications AS SELECT * FROM notifications WHERE false;

INSERT INTO archive_bot_cleanup_posts SELECT * FROM posts WHERE id IN (SELECT id FROM _bot_posts_del);
INSERT INTO archive_bot_cleanup_comments SELECT c.* FROM comments c JOIN users u ON u.id = c.author_id WHERE u.is_bot;
INSERT INTO archive_bot_cleanup_reactions SELECT r.* FROM post_reactions r JOIN users u ON u.id = r.user_id WHERE u.is_bot;
INSERT INTO archive_bot_cleanup_conversations SELECT * FROM conversations WHERE id IN (SELECT id FROM _bot_convs_del);
INSERT INTO archive_bot_cleanup_messages SELECT * FROM messages WHERE conversation_id IN (SELECT id FROM _bot_convs_del);
INSERT INTO archive_bot_cleanup_notifications SELECT n.* FROM notifications n JOIN users u ON u.id = n.actor_id WHERE u.is_bot;

-- Xóa (FK ON DELETE CASCADE lo phần phụ thuộc: bình luận con, tài liệu nhúng, tin nhắn…)
DELETE FROM notifications WHERE actor_id IN (SELECT id FROM users WHERE is_bot);
DELETE FROM comments WHERE author_id IN (SELECT id FROM users WHERE is_bot);
DELETE FROM post_reactions WHERE user_id IN (SELECT id FROM users WHERE is_bot);
DELETE FROM conversations WHERE id IN (SELECT id FROM _bot_convs_del);
DELETE FROM posts WHERE id IN (SELECT id FROM _bot_posts_del);

-- Tính lại bộ đếm (ứng dụng giữ số liệu này, không có trigger)
UPDATE posts p SET
  likes_count = (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id),
  comments_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)
WHERE likes_count IS DISTINCT FROM (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id)
   OR comments_count IS DISTINCT FROM (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id);

\echo === Sau khi dọn
SELECT (SELECT COUNT(*) FROM posts p JOIN users u ON u.id = p.author_id WHERE u.is_bot) AS bot_posts_left,
       (SELECT COUNT(*) FROM comments c JOIN users u ON u.id = c.author_id WHERE u.is_bot) AS bot_comments,
       (SELECT COUNT(*) FROM post_reactions r JOIN users u ON u.id = r.user_id WHERE u.is_bot) AS bot_reactions,
       (SELECT COUNT(*) FROM conversations c WHERE EXISTS (SELECT 1 FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id = c.id AND u.is_bot)) AS convs_with_bot,
       (SELECT COUNT(*) FROM archive_bot_cleanup_posts) AS archived_posts;

\if :commit
  \echo >>> COMMIT
  COMMIT;
\else
  \echo >>> ROLLBACK (chạy thử)
  ROLLBACK;
\endif
