// Điều kiện SQL "có quan hệ chặn 2 chiều giữa a và b" (a, b = tham số hoặc cột)
// Two-way block predicate; both directions hit an index (PK / idx_user_blocks_blocked)
export const blockExistsSql = (a: string, b: string) =>
  `EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocker_id = ${a} AND ub.blocked_id = ${b}) OR (ub.blocker_id = ${b} AND ub.blocked_id = ${a}))`

// Trạng thái chặn nhìn từ phía viewer: 'blocking' ưu tiên khi chặn lẫn nhau
export const blockStateSql = (viewer: string, other: string) =>
  `(SELECT CASE WHEN ub.blocker_id = ${viewer} THEN 'blocking' ELSE 'blocked_by' END
    FROM user_blocks ub
    WHERE (ub.blocker_id = ${viewer} AND ub.blocked_id = ${other}) OR (ub.blocker_id = ${other} AND ub.blocked_id = ${viewer})
    ORDER BY (ub.blocker_id = ${viewer}) DESC LIMIT 1)`
