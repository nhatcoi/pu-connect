-- Xem dữ liệu cá nhân hóa của 1 người (chỉ đọc) — biến psql :username
-- Read-only personalisation snapshot for one user; weights: interest-profile.sql.ts
\pset pager off
\pset null '∅'
\set ON_ERROR_STOP on
SELECT id AS uid FROM users WHERE username = :'username' \gset
\if :{?uid}
\else
  \echo 'Không tìm thấy user'
  \quit
\endif

\echo '\n== 1. Hồ sơ & cờ cá nhân hóa =='
SELECT username, display_name, major, class_name, interests, skills,
       COALESCE((privacy_settings->>'personalization')::boolean, TRUE) AS personalization,
       interests_updated_at,
       interests_updated_at < NOW() - INTERVAL '6 hours' AS stale,
       last_seen_at
FROM users WHERE id = :'uid';

\echo '\n== 2. Hồ sơ quan tâm đã lưu (user_interests) — gợi ý AI đọc top 12 =='
SELECT row_number() OVER (ORDER BY score DESC) AS "#", kind, label, round(score::numeric, 2) AS score
FROM user_interests WHERE user_id = :'uid' ORDER BY score DESC;

\echo '\n== 3. Tín hiệu nguồn (180 ngày) =='
SELECT * FROM (
  SELECT 'đăng bài (5)' AS signal, count(*) AS n, max(created_at) AS last FROM posts WHERE author_id = :'uid'
  UNION ALL SELECT 'tải tài liệu lên (5)', count(*), max(created_at) FROM documents WHERE owner_id = :'uid'
  UNION ALL SELECT 'lưu bài (4)', count(*), max(saved_at) FROM saved_posts WHERE user_id = :'uid'
  UNION ALL SELECT 'nhóm học (4)', count(*), NULL FROM study_group_members WHERE user_id = :'uid'
  UNION ALL SELECT 'bình luận (3)', count(*), max(created_at) FROM comments WHERE author_id = :'uid'
  UNION ALL SELECT 'thả cảm xúc (1)', count(*), max(created_at) FROM post_reactions WHERE user_id = :'uid'
  UNION ALL SELECT 'hỏi PU AI', count(*), max(m.created_at) FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE c.type = 'ai' AND m.sender_id = :'uid' AND m.kind = 'text' AND m.deleted_at IS NULL
) s;

\echo '\n== 4. Hành vi ghi nhận (user_events, 90 ngày) =='
SELECT type, count(*) AS n, max(created_at) AS last FROM user_events WHERE user_id = :'uid' GROUP BY type ORDER BY n DESC;

\echo '\n== 5. 30 sự kiện gần nhất =='
SELECT e.created_at, e.type,
       COALESCE(p.title, d.title, e.meta->>'q', e.meta->>'text') AS target,
       COALESCE(pc.code, dc.code) AS course,
       COALESCE(p.tags, d.tags) AS tags
FROM user_events e
LEFT JOIN posts p ON e.target_type = 'post' AND p.id = e.target_id
LEFT JOIN courses pc ON pc.id = p.course_id
LEFT JOIN documents d ON e.target_type = 'document' AND d.id = e.target_id
LEFT JOIN courses dc ON dc.id = d.course_id
WHERE e.user_id = :'uid' ORDER BY e.id DESC LIMIT 30;

\echo '\n== 6. Câu hỏi PU AI gần nhất (môn được nhận diện) =='
SELECT m.created_at, left(m.content, 80) AS question,
       (SELECT string_agg(co.code, ', ') FROM courses co
         WHERE immutable_unaccent(lower(m.content)) LIKE '%' || immutable_unaccent(lower(co.name)) || '%'
            OR lower(m.content) LIKE '%' || lower(co.code) || '%') AS courses
FROM messages m JOIN conversations c ON c.id = m.conversation_id
WHERE c.type = 'ai' AND m.sender_id = :'uid' AND m.kind = 'text' AND m.deleted_at IS NULL
ORDER BY m.id DESC LIMIT 10;
