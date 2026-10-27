// Quyền xem bài: công khai · người theo dõi tác giả · chính tác giả; bài lưu trữ chỉ tác giả thấy
// Post access: public, followers-only (viewer follows author) or the author; archived posts are author-only.
// `viewer` là biểu thức SQL (vd '$1'); bỏ trống = khách chưa đăng nhập.

export const postVisibleSql = (viewer?: string, alias = 'p'): string => {
  const isPublic = `COALESCE(${alias}.visibility, 'public') = 'public'`
  if (!viewer) return `(${isPublic})`
  const follows = `EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = ${viewer} AND uf.following_id = ${alias}.author_id)`
  return `(${isPublic} OR ${alias}.author_id = ${viewer} OR (${alias}.visibility = 'followers' AND ${follows}))`
}

// Danh sách công khai (bảng tin, tìm kiếm, cộng đồng): bỏ bài lưu trữ
export const postListedSql = (viewer?: string, alias = 'p'): string => `${postVisibleSql(viewer, alias)} AND ${alias}.archived_at IS NULL`

// Trang chi tiết: tác giả vẫn mở được bài lưu trữ / riêng tư của mình
export const postOpenableSql = (viewer?: string, alias = 'p'): string =>
  viewer ? `(${postVisibleSql(viewer, alias)} AND (${alias}.archived_at IS NULL OR ${alias}.author_id = ${viewer}))` : `(${postVisibleSql(undefined, alias)} AND ${alias}.archived_at IS NULL)`
