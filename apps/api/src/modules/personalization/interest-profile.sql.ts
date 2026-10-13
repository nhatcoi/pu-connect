import { HALF_LIFE_DAYS, PROFILE_MAX_TOPICS, SIGNAL_WINDOW_DAYS } from './personalization.constants'

// Hồ sơ quan tâm của 1 người ($1): gom tín hiệu → (kind, key) → điểm = Σ trọng số × suy giảm theo thời gian
// Interest profile: weighted, time-decayed signals grouped by course / tag / search query
//
// Trọng số (Weights):
//   đăng bài / tải tài liệu lên 5 · lưu bài 4 · vào nhóm học 4 · bình luận 3 · hỏi PU AI về môn 3
//   tải tài liệu 3 · bấm kết quả tìm 2 · mở bài / tài liệu 1.5 · tìm kiếm 1.5 · thả cảm xúc 1
//   bấm gợi ý AI 1 · sở thích / kỹ năng hồ sơ 1 · bài hiện ≥ 2s 0.5
export const INTEREST_PROFILE_SQL = `
WITH since AS (SELECT NOW() - INTERVAL '${SIGNAL_WINDOW_DAYS} days' AS t),
post_touch(post_id, w, at) AS (
  SELECT id, 5.0, created_at FROM posts WHERE author_id = $1 AND created_at > (SELECT t FROM since)
  UNION ALL SELECT post_id, 4.0, saved_at FROM saved_posts WHERE user_id = $1 AND saved_at > (SELECT t FROM since)
  UNION ALL SELECT post_id, 3.0, MAX(created_at) FROM comments WHERE author_id = $1 AND created_at > (SELECT t FROM since) GROUP BY post_id
  UNION ALL SELECT post_id, 1.0, created_at FROM post_reactions WHERE user_id = $1 AND created_at > (SELECT t FROM since)
  UNION ALL SELECT target_id, CASE type WHEN 'post_view' THEN 0.5 WHEN 'post_open' THEN 1.5 ELSE 2.0 END, created_at
    FROM user_events WHERE user_id = $1 AND target_type = 'post' AND target_id IS NOT NULL
),
doc_touch(doc_id, w, at) AS (
  SELECT id, 5.0, created_at FROM documents WHERE owner_id = $1 AND created_at > (SELECT t FROM since)
  UNION ALL SELECT target_id, CASE type WHEN 'doc_download' THEN 3.0 WHEN 'doc_open' THEN 1.5 ELSE 2.0 END, created_at
    FROM user_events WHERE user_id = $1 AND target_type = 'document' AND target_id IS NOT NULL
),
ai_questions AS (
  SELECT m.content, m.created_at FROM messages m JOIN conversations c ON c.id = m.conversation_id
  WHERE c.type = 'ai' AND m.sender_id = $1 AND m.kind = 'text' AND m.deleted_at IS NULL AND m.created_at > (SELECT t FROM since)
  ORDER BY m.id DESC LIMIT 30
),
signals(kind, key, w, at) AS (
  SELECT 'course', p.course_id::text, t.w, t.at FROM post_touch t JOIN posts p ON p.id = t.post_id WHERE p.course_id IS NOT NULL
  UNION ALL SELECT 'tag', lower(tag), t.w, t.at FROM post_touch t JOIN posts p ON p.id = t.post_id CROSS JOIN unnest(p.tags) tag
  UNION ALL SELECT 'course', d.course_id::text, t.w, t.at FROM doc_touch t JOIN documents d ON d.id = t.doc_id WHERE d.course_id IS NOT NULL
  UNION ALL SELECT 'tag', lower(tag), t.w, t.at FROM doc_touch t JOIN documents d ON d.id = t.doc_id CROSS JOIN unnest(d.tags) tag
  -- Nhóm học đang tham gia: trạng thái hiện tại ⇒ không suy giảm
  UNION ALL SELECT 'course', sg.course_id::text, 4.0, NOW() FROM study_group_members m JOIN study_groups sg ON sg.id = m.group_id
    WHERE m.user_id = $1 AND sg.course_id IS NOT NULL
  -- Câu hỏi PU AI nhắc tới tên / mã môn
  UNION ALL SELECT 'course', co.id::text, 3.0, q.created_at FROM ai_questions q JOIN courses co
    ON immutable_unaccent(lower(q.content)) LIKE '%' || immutable_unaccent(lower(co.name)) || '%'
    OR lower(q.content) LIKE '%' || lower(co.code) || '%'
  UNION ALL SELECT 'query', lower(trim(meta->>'q')), 1.5, created_at FROM user_events
    WHERE user_id = $1 AND type = 'search' AND char_length(trim(meta->>'q')) BETWEEN 2 AND 60
  UNION ALL SELECT meta->>'kind', meta->>'key', 1.0, created_at FROM user_events
    WHERE user_id = $1 AND type = 'ai_suggestion_click' AND meta->>'kind' IN ('course', 'tag', 'query') AND meta ? 'key'
  UNION ALL SELECT 'tag', lower(x), 1.0, NOW() FROM users u CROSS JOIN unnest(COALESCE(u.interests, '{}') || COALESCE(u.skills, '{}')) x
    WHERE u.id = $1
),
scored AS (
  SELECT kind, key, SUM(w * power(0.5, EXTRACT(EPOCH FROM (NOW() - at)) / 86400.0 / ${HALF_LIFE_DAYS}))::real AS score
  FROM signals WHERE key IS NOT NULL AND key <> '' GROUP BY kind, key
  ORDER BY score DESC LIMIT ${PROFILE_MAX_TOPICS}
)
SELECT s.kind, s.key, COALESCE(co.name, s.key) AS label, s.score
FROM scored s LEFT JOIN courses co ON s.kind = 'course' AND co.id::text = s.key
WHERE s.score > 0.05`

// Điểm cộng bảng tin: mức khớp chủ đề bài (môn + tag) với hồ sơ quan tâm, chuẩn hóa theo chủ đề mạnh nhất (0..max)
// Feed boost: post topic match against the viewer's profile, normalised to the top topic
export const interestBoostSql = (userParam: string, post: string, max = 40) => `COALESCE(${max}.0 * LEAST(1.0,
  (SELECT SUM(ui.score) FROM user_interests ui WHERE ui.user_id = ${userParam}
     AND ((ui.kind = 'course' AND ui.key = ${post}.course_id::text)
       OR (ui.kind = 'tag' AND ui.key = ANY(SELECT lower(t) FROM unnest(${post}.tags) t))))
  / NULLIF((SELECT MAX(score) FROM user_interests WHERE user_id = ${userParam}), 0)), 0.0)`
