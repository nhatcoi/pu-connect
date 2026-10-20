// Chính sách bot (đọc từ DB, admin cấu hình): bot nào được làm gì, chủ đề nào, hạn mức mỗi ngày.
const CACHE_MS = 15_000

const FLAG = { post: 'can_post', comment: 'can_comment', like: 'can_like' }
const LIMIT = { post: 'max_posts_per_day', comment: 'max_comments_per_day', like: 'max_likes_per_day' }

// Bỏ dấu + thường hóa để khớp từ khóa tiếng Việt
export const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')

export class BotPolicy {
  // fallbackPersonas: personas.json (tone/major cho bot cũ chưa có trong DB)
  constructor(pool, fallbackPersonas = []) {
    this.pool = pool
    this.fallback = new Map(fallbackPersonas.map((p) => [p.username, p]))
    this.loadedAt = 0
    this.profiles = new Map() // username → profile
    this.topics = new Map() // slug → { slug, label, keywords[] } (chỉ chủ đề đang bật)
    this.botIds = new Set()
    this.used = new Map() // username → { post, comment, like } hôm nay
  }

  async load(force = false) {
    if (!force && Date.now() - this.loadedAt < CACHE_MS) return
    const [profiles, topics, usage] = await Promise.all([
      this.pool.query(`SELECT u.id, u.username, u.display_name, u.faculty, u.role, p.* FROM bot_profiles p JOIN users u ON u.id = p.user_id WHERE u.is_bot AND u.status = 'active'`),
      this.pool.query(`SELECT slug, label, keywords FROM bot_topics WHERE enabled`),
      // Số việc đã làm hôm nay (giờ VN) đếm từ bảng thật; bài từ dữ liệu crawl không tính vào hạn mức bài tự sinh
      this.pool.query(`
        WITH day AS (SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS t)
        SELECT u.username,
          (SELECT COUNT(*) FROM posts x, day WHERE x.author_id = u.id AND x.created_at >= day.t)::int
            - (SELECT COUNT(*) FROM bot_feed_items f, day WHERE f.posted_by = u.username AND f.posted_at >= day.t)::int AS post,
          (SELECT COUNT(*) FROM comments x, day WHERE x.author_id = u.id AND x.created_at >= day.t)::int AS comment,
          (SELECT COUNT(*) FROM post_reactions x, day WHERE x.user_id = u.id AND x.created_at >= day.t)::int AS "like"
        FROM users u WHERE u.is_bot`)
    ])
    this.profiles = new Map(profiles.rows.map((r) => [r.username, r]))
    this.botIds = new Set(profiles.rows.map((r) => r.id))
    this.topics = new Map(topics.rows.map((r) => [r.slug, r]))
    this.used = new Map(usage.rows.map((r) => [r.username, { post: Math.max(0, r.post), comment: r.comment, like: r.like }]))
    this.loadedAt = Date.now()
  }

  // Persona dùng để viết nội dung: thông tin từ DB (admin sửa được), tone/major rơi về personas.json nếu DB trống
  personaOf(username) {
    const p = this.profiles.get(username)
    const f = this.fallback.get(username)
    return {
      username,
      displayName: p?.display_name ?? f?.displayName ?? username,
      faculty: p?.faculty ?? f?.faculty ?? '',
      role: p?.role ?? f?.role ?? 'student',
      tone: p?.tone || f?.tone || '',
      major: p?.major || f?.major || ''
    }
  }

  isBotId(userId) {
    return this.botIds.has(userId)
  }

  // Bot được làm `action` ngay bây giờ? (đang bật + có quyền + chưa hết hạn mức)
  allows(username, action) {
    const p = this.profiles.get(username)
    if (!p?.enabled || !p[FLAG[action]]) return false
    return (this.used.get(username)?.[action] ?? 0) < p[LIMIT[action]]
  }

  // Ghi nhận ngay để không vượt hạn mức giữa 2 lần nạp lại
  record(username, action) {
    const u = this.used.get(username) ?? { post: 0, comment: 0, like: 0 }
    u[action]++
    this.used.set(username, u)
  }

  eligible(action) {
    return [...this.profiles.keys()].filter((u) => this.allows(u, action))
  }

  feedPosters() {
    return [...this.profiles.values()].filter((p) => p.enabled && p.feed_poster).map((p) => p.username).sort()
  }

  topicsOf(username) {
    return (this.profiles.get(username)?.topics ?? []).map((s) => this.topics.get(s)).filter(Boolean)
  }

  // Nội dung có thuộc chủ đề được phép của bot không (khớp nguyên từ khóa, không dấu; tránh "ai" trùng trong "hai")
  matchesTopics(username, ...texts) {
    const haystack = fold(texts.flat().join(' '))
    return this.topicsOf(username).some((t) => t.keywords.some((k) => new RegExp(`(?<![a-z0-9])${fold(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(haystack)))
  }

  async hasLiked(userId, postId) {
    const { rowCount } = await this.pool.query(`SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2`, [postId, userId])
    return rowCount > 0
  }

  // Bot đã bình luận/thả tim bài này chưa (toggleLike sẽ bỏ tim nếu gọi lần 2)
  async hasEngaged(userId, postId) {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM comments WHERE post_id = $1 AND author_id = $2 UNION ALL SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1`,
      [postId, userId]
    )
    return rowCount > 0
  }
}
