import { blockExistsSql } from '../blocks/blocks.sql'

// Chọn 1 bình luận gốc nổi bật cho mỗi bài trên bảng tin (Featured comment)
// Thứ tự: Solution (Q&A) > Top (react + reply) > Relevance (lọc lạc đề) > Latest (khi sát điểm) > Earliest (bài chưa tương tác)
export const FEATURED_COMMENT = {
  // 1 reply = 2 react: trả lời tốn công hơn thả tim
  replyWeight: 2,
  // Tỉ lệ từ của bình luận có trong bài (tiêu đề/nội dung/tag) tối thiểu để được làm Top
  minRelevance: 0.3,
  // Chênh ≤ 10% điểm so với top ⇒ coi như bằng nhau, ưu tiên bình luận mới hơn
  tieRatio: 0.1,
  maxLength: 280
} as const

/**
 * $1 = post ids (uuid[]), $2 = viewer id (uuid | null)
 * Một query cho cả trang feed; DISTINCT ON trả tối đa 1 dòng / bài.
 */
export function featuredCommentsSql(): string {
  const { replyWeight, minRelevance, tieRatio, maxLength } = FEATURED_COMMENT
  // Ẩn bình luận của người có quan hệ chặn với viewer
  const visible = (alias: string) => `($2::uuid IS NULL OR NOT ${blockExistsSql('$2::uuid', `${alias}.author_id`)})`

  return `
    WITH cand AS (
      SELECT c.id, c.post_id, c.author_id, c.content, c.created_at, c.is_solution, c.is_anonymous,
             COALESCE(c.likes_count, 0) AS likes_count,
             (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id AND r.hidden_at IS NULL AND ${visible('r')})::int AS replies_count,
             -- Relevance: tỉ lệ từ (unaccent) của bình luận xuất hiện trong search_tsv của bài
             COALESCE((
               SELECT AVG((lx = ANY(tsvector_to_array(p.search_tsv)))::int)
               FROM unnest(tsvector_to_array(to_tsvector('simple', immutable_unaccent(lower(c.content))))) AS lx
             ), 0)::float AS relevance
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      WHERE c.post_id = ANY($1::uuid[]) AND c.parent_id IS NULL AND c.hidden_at IS NULL AND ${visible('c')}
    ), scored AS (
      SELECT cand.*,
             (likes_count + ${replyWeight} * replies_count)::float AS engagement,
             (likes_count + ${replyWeight} * replies_count) * (0.5 + 0.5 * relevance) AS score
      FROM cand
    ), flagged AS (
      SELECT scored.*,
             BOOL_OR(is_solution) OVER w AS has_solution,
             MAX(engagement) OVER w AS max_engagement,
             BOOL_OR(relevance >= ${minRelevance}) OVER w AS any_relevant,
             BOOL_OR(engagement > 0 AND relevance >= ${minRelevance}) OVER w AS any_relevant_engaged
      FROM scored
      WINDOW w AS (PARTITION BY post_id)
    ), pool AS (
      -- Lọc ứng viên theo tầng; tầng không có ai liên quan ⇒ nới lọc relevance
      SELECT flagged.* FROM flagged
      WHERE CASE
        WHEN has_solution THEN is_solution
        WHEN max_engagement = 0 THEN relevance >= ${minRelevance} OR NOT any_relevant
        ELSE engagement > 0 AND (relevance >= ${minRelevance} OR NOT any_relevant_engaged)
      END
    ), topped AS (
      SELECT pool.*, MAX(score) OVER (PARTITION BY post_id) AS top_score FROM pool
    )
    SELECT DISTINCT ON (t.post_id)
           t.id, t.post_id, left(t.content, ${maxLength}) AS content, t.created_at,
           t.likes_count, t.replies_count, t.is_anonymous,
           CASE WHEN t.has_solution THEN 'solution' WHEN t.max_engagement = 0 THEN 'earliest' ELSE 'top' END AS reason,
           u.id AS author_id, u.username AS author_username,
           u.display_name AS author_display_name, u.avatar_url AS author_avatar_url
    FROM topped t
    JOIN users u ON u.id = t.author_id
    WHERE t.has_solution OR t.max_engagement = 0 OR t.score >= t.top_score * ${1 - tieRatio}
    ORDER BY t.post_id,
             -- Bài chưa tương tác ⇒ sớm nhất; còn lại (nhóm sát điểm) ⇒ mới nhất
             CASE WHEN t.max_engagement = 0 AND NOT t.has_solution THEN t.created_at END ASC,
             t.created_at DESC,
             t.id
  `
}
