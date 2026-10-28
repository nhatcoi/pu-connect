// Bình luận chờ duyệt (hidden_at) chỉ hiện với chính tác giả; người khác không thấy và không bị đếm
// Held comments (hidden_at) are visible to their author only
export const commentShownSql = (alias: string, viewer: string) => `(${alias}.hidden_at IS NULL OR ${alias}.author_id = ${viewer}::uuid)`

export const HELD_REASON_PREFIX = 'auto-moderation:'
export const REJECTED_REASON = 'moderation-rejected'
