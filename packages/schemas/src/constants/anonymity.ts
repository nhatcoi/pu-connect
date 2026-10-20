// Tác giả giả dùng khi bài / bình luận ẩn danh (username có dấu gạch ngang ⇒ không ai đăng ký trùng được)
// Placeholder author for anonymous content (hyphen is invalid in real usernames ⇒ no collision)
export const ANONYMOUS_AUTHOR = {
  id: 'anonymous',
  username: 'an-danh',
  displayName: 'Ẩn danh',
  avatarUrl: null
} as const

// Hạn mức ẩn danh mỗi 24 giờ (chống lạm dụng)
export const ANONYMOUS_DAILY_LIMIT = { posts: 3, comments: 20 } as const
