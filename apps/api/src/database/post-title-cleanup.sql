-- ==========================================================
-- Data fix: bài không có tiêu đề từng bị lưu title = 50 ký tự đầu nội dung
-- ⇒ card hiện lặp lại. Đưa về rỗng (idempotent).
-- Untitled posts used to store left(content, 50) as title; reset to ''.
-- ==========================================================
UPDATE posts SET title = ''
WHERE title <> '' AND title = left(content, char_length(title)) AND char_length(title) <= 50
  AND (char_length(content) = char_length(title) OR char_length(title) = 50);
