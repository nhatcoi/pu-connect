import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { setTrashActor } from '../../database/trash'
import { MentionsService, type MentionedUser } from '../mentions/mentions.service'
import { NotificationsService } from '../notifications/notifications.service'
import { snippet } from '../notifications/notification.types'
import { blockExistsSql } from '../blocks/blocks.sql'
import { postListedSql, postOpenableSql } from './post-access.sql'
import { hotScoreSql, rankedScoreSql, seenFactorSql, seenJoinSql } from './feed-ranking.sql'
import { featuredCommentsSql } from './featured-comment.sql'
import { PostDocumentsService } from '../documents/post-documents.service'
import { anonymousAuthor, anonymizeNotification, assertAnonymousQuota } from './anonymity'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { ModerationService } from '../moderation/moderation.service'
import type { AttachedDocument, CreatePostInput, PostItem, UpdatePostInput, ReportPostInput, PollData, FeaturedComment, ProfileActivityType } from '@pu/schemas'

export interface FeedResult {
  data: PostItem[]
  total: number
  hasMore: boolean
  nextOffset: number
  // Mốc snapshot của trang; client gửi lại làm `before` cho trang sau
  snapshotAt: string
}

// Cửa sổ thời gian của feed: before = mốc snapshot, after = chỉ lấy bài mới hơn (pill "bài mới")
export interface FeedWindow {
  before?: string
  after?: string
}

// Tùy chọn feed: cửa sổ thời gian + cờ tính năng của người xem (preferences)
export interface FeedOptions extends FeedWindow {
  // false ⇒ không chạy query bình luận nổi bật
  featuredComment?: boolean
  // Tab hoạt động trên hồ sơ: bài userId đã thích / lưu / bình luận (quyền xem kiểm tra ở caller)
  activity?: { userId: string; type: ProfileActivityType }
}

// Bài thuộc hoạt động của $n + thời điểm hoạt động (sắp xếp mới nhất trước)
// Activity filter: EXISTS for the WHERE, latest activity time for ORDER BY
const ACTIVITY_SQL: Record<ProfileActivityType, { exists: (u: string) => string; at: (u: string) => string }> = {
  liked: {
    exists: (u) => `EXISTS(SELECT 1 FROM post_reactions a WHERE a.post_id = p.id AND a.user_id = ${u})`,
    at: (u) => `(SELECT a.created_at FROM post_reactions a WHERE a.post_id = p.id AND a.user_id = ${u})`
  },
  saved: {
    exists: (u) => `EXISTS(SELECT 1 FROM saved_posts a WHERE a.post_id = p.id AND a.user_id = ${u})`,
    at: (u) => `(SELECT a.saved_at FROM saved_posts a WHERE a.post_id = p.id AND a.user_id = ${u})`
  },
  commented: {
    // Bình luận ẩn danh không hiện trong hoạt động công khai của người viết
    exists: (u) => `EXISTS(SELECT 1 FROM comments a WHERE a.post_id = p.id AND a.author_id = ${u} AND NOT a.is_anonymous)`,
    at: (u) => `(SELECT MAX(a.created_at) FROM comments a WHERE a.post_id = p.id AND a.author_id = ${u} AND NOT a.is_anonymous)`
  }
}

export interface NewPostsSummary {
  count: number
  authors: { id: string; username: string; displayName: string; avatarUrl: string | null }[]
}

// Loại bài của UI → giá trị enum trong DB
const DB_POST_TYPE: Record<string, string> = { general: 'general', qa: 'question', document: 'resource_share', group_recruit: 'pbl_recruitment', review: 'review' }
const VISIBILITIES = ['public', 'followers', 'private']

const DB_POST_TYPES = new Set(Object.values(DB_POST_TYPE))
const toDbPostType = (type = 'general'): string => DB_POST_TYPE[type] ?? (DB_POST_TYPES.has(type) ? type : 'general')

// Đếm tối đa N bài mới (pill hiển thị "N+")
const NEW_POSTS_MAX = 50
const FOLLOWER_NOTIFY_LIMIT = 1000 // trần số follower được báo mỗi bài mới

function parseIsoDate(value?: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly mentions: MentionsService,
    private readonly postDocuments: PostDocumentsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
    private readonly moderation: ModerationService
  ) {}

  async findAll(
    currentUserId?: string,
    tag?: string,
    limit = 10,
    offset = 0,
    feedType = 'for_you',
    courseCode?: string,
    window: FeedOptions = {}
  ): Promise<FeedResult> {
    const safeLimit = Math.min(50, Math.max(1, limit))
    const safeOffset = Math.max(0, offset)

    const params: any[] = []
    const filter = this.buildFeedFilter(params, currentUserId, tag, feedType, courseCode)
    const { joins } = filter
    let { whereClause, orderBy } = filter

    if (window.activity) {
      params.push(window.activity.userId)
      const u = `$${params.length}::uuid`
      const sqlOf = ACTIVITY_SQL[window.activity.type]
      whereClause += ` AND ${sqlOf.exists(u)}`
      orderBy = `ORDER BY ${sqlOf.at(u)} DESC NULLS LAST, p.created_at DESC`
    }

    // Mốc snapshot: trang sau chỉ lấy bài ≤ mốc ⇒ bài mới không đẩy lệch offset (pill "bài mới" lo phần > mốc)
    // Snapshot window keeps offset pagination stable while new posts arrive
    const snapshotAt = parseIsoDate(window.before) ?? new Date()
    params.push(snapshotAt.toISOString())
    const snapshot = `$${params.length}`
    whereClause += ` AND p.created_at <= ${snapshot}`
    const after = parseIsoDate(window.after)
    if (after) {
      params.push(after.toISOString())
      whereClause += ` AND p.created_at > $${params.length}`
    }

    // Hot-rank chỉ khi feed sắp theo điểm (for_you / qa / courses); tab theo thời gian bỏ qua
    // Ranked feeds: score once via LATERAL, seen penalty + author diversity in the select
    const ranked = orderBy.includes('recommendation_score')
    let rankJoins = ''
    let scoreSelect = `0.0`
    if (ranked) {
      const viewer = currentUserId ? '$1' : undefined
      if (viewer) rankJoins += seenJoinSql(viewer, snapshot)
      rankJoins += ` CROSS JOIN LATERAL (SELECT ${hotScoreSql(snapshot, viewer)}${viewer ? ` * ${seenFactorSql}` : ''} AS score) rk`
      scoreSelect = rankedScoreSql
    }

    // 1. Get total count
    const countSql = `SELECT COUNT(*) as total ${joins} ${whereClause}`
    const countRes = await this.db.query(countSql, params)
    const total = parseInt(countRes.rows[0]?.total || '0', 10)

    // 2. Query posts with score
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name,
             comm.slug as community_slug, comm.name as community_name,
             ${scoreSelect} as recommendation_score
    `

    if (currentUserId) {
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1) as is_liked_by_me,
               EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1) as is_bookmarked_by_me,
               EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $1 AND uf.following_id = p.author_id) as is_author_followed_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me, FALSE as is_bookmarked_by_me, FALSE as is_author_followed_by_me`
    }

    sql += `${joins}${rankJoins} ${whereClause}`

    params.push(safeLimit, safeOffset)
    sql += ` ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`

    const res = await this.db.query(sql, params)

    // 3. Batch fetch polls + bình luận nổi bật cho các bài trong trang
    const postIds = res.rows.map((r) => r.id)
    const [pollsMap, featuredMap, docsMap] = await Promise.all([
      this.fetchPollsForPosts(postIds, currentUserId),
      window.featuredComment === false ? new Map<string, FeaturedComment>() : this.fetchFeaturedComments(postIds, currentUserId),
      this.postDocuments.forPosts(postIds)
    ])

    const items = res.rows.map((row) => ({
      ...this.mapRowToPostItem(row, pollsMap.get(row.id), currentUserId),
      featuredComment: featuredMap.get(row.id) ?? null,
      documents: docsMap.get(row.id) ?? []
    }))

    return {
      data: items,
      total,
      hasMore: safeOffset + items.length < total,
      nextOffset: safeOffset + items.length,
      snapshotAt: snapshotAt.toISOString()
    }
  }

  // Đếm bài mới > since cho pill "bài mới" (cùng bộ lọc với feed); kèm ≤ 3 tác giả, ưu tiên người mình follow
  // New-posts pill: count + up to 3 distinct authors, followed authors first
  async countNewSince(
    currentUserId: string | undefined,
    query: { since?: string; tag?: string; feedType?: string; courseCode?: string }
  ): Promise<NewPostsSummary> {
    const since = parseIsoDate(query.since)
    if (!since) return { count: 0, authors: [] }

    const params: any[] = []
    const { joins, whereClause } = this.buildFeedFilter(params, currentUserId, query.tag, query.feedType || 'for_you', query.courseCode)
    params.push(since.toISOString())
    let where = `${whereClause} AND p.created_at > $${params.length}`
    // Bài của chính mình đã chèn sẵn (optimistic) ⇒ không đếm
    if (currentUserId) where += ` AND p.author_id <> $1`

    const followedSql = currentUserId ? `EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $1 AND uf.following_id = f.author_id) DESC,` : ''
    const res = await this.db.query(
      `WITH fresh AS (
         SELECT p.author_id, p.created_at, p.is_anonymous ${joins} ${where}
         ORDER BY p.created_at DESC LIMIT ${NEW_POSTS_MAX}
       )
       SELECT (SELECT COUNT(*)::int FROM fresh) AS count,
              COALESCE((
                SELECT json_agg(a) FROM (
                  SELECT u.id, u.username, u.display_name AS "displayName", u.avatar_url AS "avatarUrl"
                  FROM (SELECT author_id, MAX(created_at) AS last_at FROM fresh WHERE NOT is_anonymous GROUP BY author_id) f
                  JOIN users u ON u.id = f.author_id
                  ORDER BY ${followedSql} f.last_at DESC
                  LIMIT 3
                ) a
              ), '[]'::json) AS authors`,
      params
    )
    return { count: res.rows[0]?.count || 0, authors: res.rows[0]?.authors || [] }
  }

  // Bộ lọc feed dùng chung (findAll + countNewSince). Viewer (nếu có) luôn là $1
  // Shared feed filter; pushes viewer as $1 when present
  private buildFeedFilter(
    params: any[],
    currentUserId: string | undefined,
    tag: string | undefined,
    feedType: string,
    courseCode?: string
  ): { joins: string; whereClause: string; orderBy: string } {
    let joins = ` FROM posts p JOIN users u ON p.author_id = u.id LEFT JOIN courses c ON p.course_id = c.id LEFT JOIN communities comm ON p.community_id = comm.id`
    if (currentUserId) {
      params.push(currentUserId)
      joins += ` LEFT JOIN users cu ON cu.id = $1`
    }

    // Bài bị admin ẩn không xuất hiện trên bảng tin; riêng tư / chỉ người theo dõi / lưu trữ theo quyền xem
    // Mục Lưu trữ: chỉ bài lưu trữ của chính mình
    const viewer = currentUserId ? '$1' : undefined
    let whereClause =
      feedType === 'archived'
        ? ` WHERE p.hidden_at IS NULL AND ${viewer ? 'p.author_id = $1 AND p.archived_at IS NOT NULL' : '1=0'}`
        : ` WHERE p.hidden_at IS NULL AND ${postListedSql(viewer)}`
    // Ẩn bài của người có quan hệ chặn với mình
    if (currentUserId) whereClause += ` AND NOT ${blockExistsSql('$1', 'p.author_id')}`

    if (tag) {
      params.push(tag)
      whereClause += ` AND $${params.length} = ANY(p.tags)`
    }

    // Trang học phần: chỉ bài gắn môn đó (theo mã hoặc id)
    if (courseCode) {
      params.push(courseCode)
      whereClause += ` AND (c.code ILIKE $${params.length} OR c.id::text = $${params.length})`
    }

    let orderBy = `ORDER BY recommendation_score DESC, p.created_at DESC`

    if (feedType === 'following') {
      if (currentUserId) {
        // Bài ẩn danh không vào tab Đang theo dõi (lọt vào đó là lộ tác giả)
        whereClause += ` AND NOT p.is_anonymous AND EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $1 AND uf.following_id = p.author_id)`
      } else {
        whereClause += ` AND 1=0`
      }
      orderBy = `ORDER BY p.created_at DESC`
    } else if (feedType === 'archived') {
      orderBy = `ORDER BY p.archived_at DESC`
    } else if (feedType === 'qa') {
      whereClause += ` AND p.post_type = 'question'`
    } else if (feedType === 'courses') {
      whereClause += ` AND (p.course_id IS NOT NULL OR p.post_type IN ('question', 'resource_share'))`
    } else if (feedType === 'bookmarks' && currentUserId) {
      whereClause += ` AND EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1)`
      orderBy = `ORDER BY p.created_at DESC`
    }

    return { joins, whereClause, orderBy }
  }

  async findOne(id: string, currentUserId?: string): Promise<PostItem> {
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name,
             comm.slug as community_slug, comm.name as community_name
    `
    const params: any[] = [id]

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $2) as is_liked_by_me,
               EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2) as is_bookmarked_by_me,
               EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $2 AND uf.following_id = p.author_id) as is_author_followed_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me, FALSE as is_bookmarked_by_me, FALSE as is_author_followed_by_me`
    }

    sql += ` FROM posts p JOIN users u ON p.author_id = u.id LEFT JOIN courses c ON p.course_id = c.id LEFT JOIN communities comm ON p.community_id = comm.id WHERE p.id = $1
             AND (p.hidden_at IS NULL${currentUserId ? ' OR p.author_id = $2' : ''}) AND ${postOpenableSql(currentUserId ? '$2' : undefined)} LIMIT 1`

    const res = await this.db.query(sql, params)
    if (res.rows.length === 0) {
      throw new NotFoundException(`Bài viết không tồn tại (ID: ${id})`)
    }

    const [pollsMap, docsMap] = await Promise.all([this.fetchPollsForPosts([id], currentUserId), this.postDocuments.forPosts([id])])
    return { ...this.mapRowToPostItem(res.rows[0], pollsMap.get(id), currentUserId), documents: docsMap.get(id) ?? [] }
  }

  async create(authorId: string, data: CreatePostInput): Promise<PostItem> {
    let mentioned: MentionedUser[] = []
    const anonymous = !!data.isAnonymous
    // Kiểm duyệt tự động: từ cấm ⇒ chặn ngay; hate ⇒ lưu nhưng ẩn chờ admin (posts.hidden_at)
    const verdict = await this.moderation.check({ text: [data.title, data.content].filter(Boolean).join('\n'), userId: authorId, surface: 'post' })
    if (verdict.action === 'block') throw new BadRequestException('Nội dung chứa ngôn từ không phù hợp với quy tắc cộng đồng')
    const held = verdict.action === 'hold'
    const created = await this.db.transaction(async (client) => {
      // 1. Resolve author details
      const userRes = await client.query(`SELECT id, username, display_name, avatar_url, role, faculty, reputation_points FROM users WHERE id = $1 LIMIT 1`, [
        authorId
      ])

      if (userRes.rows.length === 0) {
        throw new NotFoundException('Tài khoản người dùng không tồn tại')
      }
      const authorUser = userRes.rows[0]

      // 2. Resolve course_id
      let courseUuid: string | null = null
      let courseCode: string | null = null
      let courseName: string | null = null

      if (data.courseId) {
        const courseRes = await client.query(`SELECT id, code, name FROM courses WHERE id::text = $1 OR code ILIKE $1 LIMIT 1`, [data.courseId])
        if (courseRes.rows.length > 0) {
          courseUuid = courseRes.rows[0].id
          courseCode = courseRes.rows[0].code
          courseName = courseRes.rows[0].name
        }
      }

      // 2.1. Resolve community
      let communityUuid: string | null = null
      let communitySlug: string | null = null
      let communityName: string | null = null

      if (data.communityId || data.communitySlug) {
        const commTarget = data.communityId || data.communitySlug
        const commRes = await client.query(`SELECT id, slug, name FROM communities WHERE id::text = $1 OR slug = $1 LIMIT 1`, [commTarget])
        if (commRes.rows.length > 0) {
          communityUuid = commRes.rows[0].id
          communitySlug = commRes.rows[0].slug
          communityName = commRes.rows[0].name
        }
      }

      // 3. Normalize post_type
      const dbPostType = toDbPostType(data.postType)

      // 3.1. Ẩn danh: chỉ bài hỏi đáp công khai, có hạn mức 24h
      if (anonymous) {
        if (data.communityId || data.communitySlug) throw new BadRequestException('Bài ẩn danh không đăng vào cộng đồng được')
        if (dbPostType !== 'question') throw new BadRequestException('Chỉ bài hỏi đáp mới đăng ẩn danh được')
        if ((data.visibility || 'public') !== 'public') throw new BadRequestException('Bài ẩn danh phải ở chế độ công khai')
        await assertAnonymousQuota(client, 'posts', authorId)
      }

      // 4. Insert Post into PostgreSQL
      const insertRes = await client.query(
        `INSERT INTO posts (
          author_id, course_id, community_id, post_type, title, content, tags, media_urls, attached_document_ids, visibility, is_anonymous
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          authorId,
          courseUuid,
          communityUuid,
          dbPostType,
          data.title?.trim() || '', // không tiêu đề ⇒ rỗng (card không lặp lại đoạn đầu nội dung)
          data.content,
          data.tags || [],
          data.mediaUrls || [],
          data.attachedDocumentIds || [],
          data.visibility || 'public',
          anonymous
        ]
      )

      const postRow = insertRes.rows[0]
      if (held) {
        await client.query(`UPDATE posts SET hidden_at = NOW(), hidden_reason = $2 WHERE id = $1`, [postRow.id, `auto-moderation: ${verdict.reason}`])
      }

      // 4.1. Ghi @mention trong cùng transaction
      mentioned = await this.mentions.record(client, 'post', postRow.id, authorId, data.title, data.content)

      // 4.2. Tài liệu đính kèm (bản nháp đã tải lên) ⇒ published + post_documents
      let attachedDocs: AttachedDocument[] = []
      if (data.documentIds?.length) {
        await this.postDocuments.attach(client, postRow.id, authorId, data.documentIds, data.visibility || 'public')
        attachedDocs = (await this.postDocuments.forPosts([postRow.id], client)).get(postRow.id) ?? []
        postRow.attached_document_ids = attachedDocs.map((d) => d.fileUrl)
      }

      // 5. Create Poll if provided
      let pollData: PollData | null = null
      if (data.pollQuestion && data.pollOptions && data.pollOptions.length >= 2) {
        const pollRes = await client.query(`INSERT INTO post_polls (post_id, question, total_votes) VALUES ($1, $2, 0) RETURNING *`, [
          postRow.id,
          data.pollQuestion
        ])
        const pollRow = pollRes.rows[0]
        const optionsList: any[] = []

        for (let i = 0; i < data.pollOptions.length; i++) {
          const optText = data.pollOptions[i].trim()
          if (!optText) continue
          const optRes = await client.query(
            `INSERT INTO post_poll_options (poll_id, option_text, votes_count, display_order)
             VALUES ($1, $2, 0, $3) RETURNING *`,
            [pollRow.id, optText, i]
          )
          optionsList.push({
            id: optRes.rows[0].id,
            pollId: pollRow.id,
            optionText: optRes.rows[0].option_text,
            votesCount: 0,
            displayOrder: i
          })
        }

        pollData = {
          id: pollRow.id,
          postId: postRow.id,
          question: pollRow.question,
          totalVotes: 0,
          options: optionsList,
          myVotedOptionId: null
        }
      }

      // 7. Increment post_count for course
      if (courseUuid) {
        await client.query(`UPDATE courses SET post_count = post_count + 1 WHERE id = $1`, [courseUuid])
      }

      // 8. Increment posts_count for community
      if (communityUuid) {
        await client.query(`UPDATE communities SET posts_count = posts_count + 1 WHERE id = $1`, [communityUuid])
      }

      return {
        id: postRow.id,
        authorId: anonymous ? anonymousAuthor().id : authorUser.id,
        author: anonymous
          ? anonymousAuthor()
          : {
              id: authorUser.id,
              username: authorUser.username,
              displayName: authorUser.display_name,
              avatarUrl: authorUser.avatar_url,
              role: authorUser.role,
              faculty: authorUser.faculty,
              reputationPoints: authorUser.reputation_points
            },
        isAnonymous: anonymous,
        isMine: true,
        title: postRow.title,
        content: postRow.content,
        postType: data.postType || 'general',
        courseId: courseUuid,
        courseCode,
        courseName,
        communityId: communityUuid,
        communitySlug,
        communityName,
        facultyCode: anonymous ? null : authorUser.faculty,
        targetAudience: data.targetAudience || 'everyone',
        isPinned: false,
        isResolved: false,
        recruitSlotsTotal: data.recruitSlotsTotal,
        recruitSlotsFilled: data.recruitSlotsFilled,
        tags: postRow.tags || [],
        mediaUrls: postRow.media_urls || [],
        attachedDocumentIds: postRow.attached_document_ids || [],
        documents: attachedDocs,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLikedByMe: false,
        isBookmarkedByMe: false,
        isAuthorFollowedByMe: false,
        poll: pollData,
        createdAt: postRow.created_at.toISOString(),
        updatedAt: postRow.updated_at.toISOString()
      }
    })

    void this.moderation.attachTarget(verdict.eventId, 'post', created.id)
    // Bài đang chờ duyệt: chưa báo ai (mention/follower) cho tới khi admin duyệt
    if (held) return created
    // Thông báo mention sau khi commit; ẩn danh: không nêu người gửi, không báo follower
    const mentionEvents = this.mentions.toNotifications(mentioned, {
      sourceType: 'post',
      sourceId: created.id,
      authorId,
      postId: created.id,
      snippet: created.title || created.content
    })
    void this.notifications.dispatch(anonymous ? mentionEvents.map(anonymizeNotification) : mentionEvents)
    if (!anonymous) void this.signalFollowers(authorId, created.id)
    if (!anonymous) void this.notifyFollowers(authorId, created)
    return created
  }

  // Báo follower đang online "có bài mới" (chỉ là tín hiệu; client gọi /posts/new-since để lấy số thật)
  // Lightweight hint — the new-since endpoint stays the source of truth (blocks, hidden, tab filters)
  private async signalFollowers(authorId: string, postId: string): Promise<void> {
    try {
      const res = await this.db.query(`SELECT follower_id FROM user_follows WHERE following_id = $1`, [authorId])
      this.realtime.emitToUsers(
        res.rows.map((r) => r.follower_id),
        'feed:new_post',
        { postId, authorId }
      )
    } catch (err) {
      this.logger.warn(`[FeedSignal] skipped: ${(err as Error).message}`)
    }
  }

  // Bài mới ⇒ thông báo trong app cho người đang theo dõi tác giả (mặc định không push); chỉ bài ai cũng xem được
  // Notify followers in-app; fan-out runs after commit, capped, failures never affect posting
  private async notifyFollowers(authorId: string, post: PostItem): Promise<void> {
    if (post.targetAudience !== 'everyone' && post.targetAudience !== 'followers') return
    try {
      const res = await this.db.query(`SELECT follower_id FROM user_follows WHERE following_id = $1 LIMIT $2`, [authorId, FOLLOWER_NOTIFY_LIMIT])
      await this.notifications.fanOut(
        res.rows.map((r) => ({
          type: 'followed_post' as const,
          recipientId: r.follower_id as string,
          actorId: authorId,
          verb: 'đã đăng bài viết mới',
          message: snippet(post.title || post.content),
          entityType: 'post' as const,
          entityId: post.id,
          link: `/post/${post.id}`
        }))
      )
    } catch (err) {
      this.logger.warn(`[FollowedPost] skipped: ${(err as Error).message}`)
    }
  }

  // Sửa bài (tác giả hoặc admin): nội dung, loại bài, học phần, quyền xem, thẻ, ảnh; chỉ trường được gửi mới đổi
  async update(postId: string, userId: string, data: UpdatePostInput): Promise<PostItem> {
    if (data.visibility !== undefined && !VISIBILITIES.includes(data.visibility)) throw new BadRequestException('Chế độ hiển thị không hợp lệ')
    if (data.postType !== undefined && !(data.postType in DB_POST_TYPE)) throw new BadRequestException('Loại bài không hợp lệ')
    if (data.content !== undefined && !data.content.trim()) throw new BadRequestException('Nội dung bài viết không được để trống')
    const textChanged = data.title !== undefined || data.content !== undefined

    // Sửa nội dung cũng qua kiểm duyệt như lúc đăng (từ cấm ⇒ chặn; hate ⇒ ẩn chờ admin)
    const verdict = textChanged ? await this.moderation.check({ text: [data.title, data.content].filter(Boolean).join('\n'), userId, surface: 'post' }) : null
    if (verdict?.action === 'block') throw new BadRequestException('Nội dung chứa ngôn từ không phù hợp với quy tắc cộng đồng')

    let mentioned: MentionedUser[] = []
    await this.db.transaction(async (client) => {
      const postRes = await client.query(`SELECT * FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`, [postId])
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này')
      }

      const visibility = data.visibility ?? (VISIBILITIES.includes(post.visibility) ? post.visibility : 'public')
      const dbPostType = data.postType !== undefined ? toDbPostType(data.postType) : post.post_type
      // Bài ẩn danh: luôn là hỏi đáp công khai (giữ như lúc đăng)
      if (post.is_anonymous && (visibility !== 'public' || dbPostType !== 'question')) {
        throw new BadRequestException('Bài ẩn danh phải là hỏi đáp ở chế độ công khai')
      }

      // Học phần: null/'' = gỡ; giá trị mới phải tồn tại (id hoặc mã)
      let courseId: string | null = post.course_id
      if (data.courseId !== undefined) {
        if (!data.courseId) courseId = null
        else {
          const courseRes = await client.query(`SELECT id FROM courses WHERE id::text = $1 OR code ILIKE $1 LIMIT 1`, [data.courseId])
          if (courseRes.rows.length === 0) throw new BadRequestException('Học phần không tồn tại')
          courseId = courseRes.rows[0].id
        }
      }

      const title = data.title !== undefined ? data.title.trim() : post.title
      const content = data.content !== undefined ? data.content : post.content
      const tags = data.tags !== undefined ? data.tags : post.tags
      const mediaUrls = data.mediaUrls !== undefined ? data.mediaUrls : post.media_urls

      await client.query(
        `UPDATE posts SET title = $2, content = $3, tags = $4, post_type = $5, course_id = $6, visibility = $7, media_urls = $8, updated_at = NOW() WHERE id = $1`,
        [postId, title, content, tags, dbPostType, courseId, visibility, mediaUrls]
      )

      if (courseId !== post.course_id) {
        if (post.course_id) await client.query(`UPDATE courses SET post_count = GREATEST(0, post_count - 1) WHERE id = $1`, [post.course_id])
        if (courseId) await client.query(`UPDATE courses SET post_count = post_count + 1 WHERE id = $1`, [courseId])
      }

      // Tài liệu đính kèm theo quyền xem của bài (không công khai ⇒ riêng tư)
      if (visibility !== post.visibility) {
        await client.query(
          `UPDATE documents d SET visibility = CASE WHEN $2 = 'public' THEN 'public' ELSE 'private' END, updated_at = NOW()
            FROM post_documents pd WHERE pd.post_id = $1 AND pd.document_id = d.id AND d.owner_id = $3`,
          [postId, visibility, post.author_id]
        )
      }

      if (verdict?.action === 'hold') {
        await client.query(`UPDATE posts SET hidden_at = NOW(), hidden_reason = $2 WHERE id = $1`, [postId, `auto-moderation: ${verdict.reason}`])
      }

      // Chỉ người mới được nhắc mới nhận thông báo
      if (textChanged) mentioned = await this.mentions.record(client, 'post', postId, userId, title, content)
    })

    // Đọc lại sau khi commit (findOne dùng kết nối khác, không thấy dữ liệu chưa commit)
    const updated = await this.findOne(postId, userId)

    const editMentions = this.mentions.toNotifications(mentioned, {
      sourceType: 'post',
      sourceId: postId,
      authorId: userId,
      postId,
      snippet: updated.title || updated.content
    })
    void this.notifications.dispatch(updated.isAnonymous ? editMentions.map(anonymizeNotification) : editMentions)
    return updated
  }

  // Lưu trữ / bỏ lưu trữ (chỉ tác giả): bài lưu trữ biến khỏi bảng tin, tìm kiếm, hồ sơ; không mất bình luận / lượt thích
  async setArchived(postId: string, userId: string, archived: boolean): Promise<{ success: boolean; archivedAt: string | null }> {
    const res = await this.db.query(`SELECT author_id FROM posts WHERE id = $1 LIMIT 1`, [postId])
    if (res.rows.length === 0) throw new NotFoundException('Bài viết không tồn tại')
    if (res.rows[0].author_id !== userId) throw new ForbiddenException('Chỉ tác giả mới lưu trữ được bài viết này')

    // Lưu trữ cũng bỏ ghim khỏi hồ sơ
    const upd = await this.db.query(
      `UPDATE posts SET archived_at = CASE WHEN $2 THEN COALESCE(archived_at, NOW()) ELSE NULL END, is_pinned = CASE WHEN $2 THEN FALSE ELSE is_pinned END
        WHERE id = $1 RETURNING archived_at`,
      [postId, archived]
    )
    return { success: true, archivedAt: upd.rows[0].archived_at ? new Date(upd.rows[0].archived_at).toISOString() : null }
  }

  async delete(postId: string, userId: string): Promise<{ success: boolean }> {
    return this.db.transaction(async (client) => {
      const postRes = await client.query(`SELECT author_id, course_id FROM posts WHERE id = $1 LIMIT 1`, [postId])
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền xóa bài viết này')
      }

      await setTrashActor(client, userId)
      await client.query(`DELETE FROM posts WHERE id = $1`, [postId])

      if (post.course_id) {
        await client.query(`UPDATE courses SET post_count = GREATEST(0, post_count - 1) WHERE id = $1`, [post.course_id])
      }

      return { success: true }
    })
  }

  async toggleLike(postId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    let post: { author_id: string; title: string | null; content: string } | undefined
    const result = await this.db.transaction(async (client) => {
      const postRes = await client.query(`SELECT author_id, title, content FROM posts WHERE id = $1`, [postId])
      post = postRes.rows[0]
      if (!post) throw new NotFoundException('Bài viết không tồn tại')

      const check = await client.query(`SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`, [postId, userId])

      let isLiked = false
      if (check.rows.length > 0) {
        await client.query(`DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`, [postId, userId])
        const res = await client.query(`UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count`, [postId])
        isLiked = false
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      } else {
        await client.query(`INSERT INTO post_reactions (post_id, user_id, reaction) VALUES ($1, $2, 'like')`, [postId, userId])
        const res = await client.query(`UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count`, [postId])
        isLiked = true
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      }
    })

    // Gộp: "A và N người khác đã thích bài viết của bạn"
    if (result.isLiked && post) {
      void this.notifications.dispatch([
        {
          type: 'post_like',
          recipientId: post.author_id,
          actorId: userId,
          verb: 'đã thích bài viết của bạn',
          message: snippet(post.title || post.content),
          entityType: 'post',
          entityId: postId,
          link: `/post/${postId}`,
          groupKey: `post_like:${postId}`
        }
      ])
    }
    return result
  }

  async toggleBookmark(postId: string, userId: string): Promise<{ isBookmarked: boolean }> {
    return this.db.transaction(async (client) => {
      const check = await client.query(`SELECT 1 FROM saved_posts WHERE post_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`, [postId, userId])

      if (check.rows.length > 0) {
        await client.query(`DELETE FROM saved_posts WHERE post_id = $1 AND user_id = $2`, [postId, userId])
        return { isBookmarked: false }
      } else {
        await client.query(`INSERT INTO saved_posts (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, userId])
        return { isBookmarked: true }
      }
    })
  }

  async votePoll(postId: string, userId: string, optionId: string): Promise<PollData> {
    return this.db.transaction(async (client) => {
      const pollRes = await client.query(`SELECT id FROM post_polls WHERE post_id = $1 LIMIT 1`, [postId])
      if (pollRes.rows.length === 0) {
        throw new NotFoundException('Khảo sát không tồn tại cho bài viết này')
      }
      const pollId = pollRes.rows[0].id

      const optRes = await client.query(`SELECT id FROM post_poll_options WHERE id = $1 AND poll_id = $2 LIMIT 1`, [optionId, pollId])
      if (optRes.rows.length === 0) {
        throw new BadRequestException('Phương án bình chọn không hợp lệ')
      }

      // Check existing vote
      const voteCheck = await client.query(`SELECT option_id FROM post_poll_votes WHERE poll_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`, [pollId, userId])

      if (voteCheck.rows.length > 0) {
        const prevOptId = voteCheck.rows[0].option_id
        if (prevOptId === optionId) {
          // Already voted this option
        } else {
          // Change vote
          await client.query(`UPDATE post_poll_options SET votes_count = GREATEST(0, votes_count - 1) WHERE id = $1`, [prevOptId])
          await client.query(`UPDATE post_poll_options SET votes_count = votes_count + 1 WHERE id = $1`, [optionId])
          await client.query(`UPDATE post_poll_votes SET option_id = $1, voted_at = NOW() WHERE poll_id = $2 AND user_id = $3`, [optionId, pollId, userId])
        }
      } else {
        // New vote
        await client.query(`INSERT INTO post_poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)`, [pollId, optionId, userId])
        await client.query(`UPDATE post_poll_options SET votes_count = votes_count + 1 WHERE id = $1`, [optionId])
        await client.query(`UPDATE post_polls SET total_votes = total_votes + 1 WHERE id = $1`, [pollId])
      }

      const map = await this.fetchPollsForPosts([postId], userId)
      const updatedPoll = map.get(postId)
      if (!updatedPoll) {
        throw new NotFoundException('Không tìm thấy thông tin khảo sát sau khi bình chọn')
      }
      return updatedPoll
    })
  }

  async togglePin(postId: string, userId: string): Promise<{ isPinned: boolean }> {
    return this.db.transaction(async (client) => {
      const postRes = await client.query(`SELECT author_id, is_pinned FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`, [postId])
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền ghim bài viết này')
      }

      const nextIsPinned = !post.is_pinned
      await client.query(`UPDATE posts SET is_pinned = $1, updated_at = NOW() WHERE id = $2`, [nextIsPinned, postId])

      return { isPinned: nextIsPinned }
    })
  }

  async toggleResolve(postId: string, userId: string): Promise<{ isResolved: boolean }> {
    return this.db.transaction(async (client) => {
      const postRes = await client.query(`SELECT author_id, is_resolved FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`, [postId])
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền thay đổi trạng thái câu hỏi này')
      }

      const nextIsResolved = !post.is_resolved
      await client.query(`UPDATE posts SET is_resolved = $1, updated_at = NOW() WHERE id = $2`, [nextIsResolved, postId])

      return { isResolved: nextIsResolved }
    })
  }

  async report(postId: string, reporterId: string, data: ReportPostInput): Promise<{ success: boolean }> {
    await this.db.query(`INSERT INTO post_reports (post_id, reporter_id, reason, details) VALUES ($1, $2, $3, $4)`, [
      postId,
      reporterId,
      data.reason,
      data.details || null
    ])
    return { success: true }
  }

  private async fetchPollsForPosts(postIds: string[], currentUserId?: string): Promise<Map<string, PollData>> {
    const map = new Map<string, PollData>()
    if (postIds.length === 0) return map

    const pollsRes = await this.db.query(
      `SELECT p.id as poll_id, p.post_id, p.question, p.total_votes, p.expires_at, p.created_at,
              o.id as option_id, o.option_text, o.votes_count, o.display_order
       FROM post_polls p
       JOIN post_poll_options o ON p.id = o.poll_id
       WHERE p.post_id = ANY($1)
       ORDER BY p.post_id, o.display_order ASC`,
      [postIds]
    )

    const myVotesMap = new Map<string, string>()
    if (currentUserId) {
      const pollIds = Array.from(new Set(pollsRes.rows.map((r) => r.poll_id)))
      if (pollIds.length > 0) {
        const votesRes = await this.db.query(`SELECT poll_id, option_id FROM post_poll_votes WHERE user_id = $1 AND poll_id = ANY($2)`, [
          currentUserId,
          pollIds
        ])
        for (const row of votesRes.rows) {
          myVotesMap.set(row.poll_id, row.option_id)
        }
      }
    }

    for (const row of pollsRes.rows) {
      let poll = map.get(row.post_id)
      if (!poll) {
        poll = {
          id: row.poll_id,
          postId: row.post_id,
          question: row.question,
          totalVotes: row.total_votes || 0,
          options: [],
          myVotedOptionId: myVotesMap.get(row.poll_id) || null,
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null
        }
        map.set(row.post_id, poll)
      }

      poll.options.push({
        id: row.option_id,
        pollId: row.poll_id,
        optionText: row.option_text,
        votesCount: row.votes_count || 0,
        displayOrder: row.display_order || 0
      })
    }

    return map
  }

  // Featured comment cho feed; lỗi (vd. thiếu search-upgrade.sql) không làm hỏng bảng tin
  private async fetchFeaturedComments(postIds: string[], currentUserId?: string): Promise<Map<string, FeaturedComment>> {
    const map = new Map<string, FeaturedComment>()
    if (postIds.length === 0) return map

    try {
      const res = await this.db.query(featuredCommentsSql(), [postIds, currentUserId ?? null])
      for (const row of res.rows) {
        map.set(row.post_id, {
          id: row.id,
          content: row.content,
          likesCount: row.likes_count || 0,
          repliesCount: row.replies_count || 0,
          reason: row.reason,
          createdAt: new Date(row.created_at).toISOString(),
          isAnonymous: !!row.is_anonymous,
          author: row.is_anonymous
            ? anonymousAuthor()
            : {
                id: row.author_id,
                username: row.author_username || 'user',
                displayName: row.author_display_name || 'Sinh viên Phenikaa',
                avatarUrl: row.author_avatar_url || null
              }
        })
      }
    } catch (err) {
      this.logger.warn(`[FeaturedComment] skipped: ${(err as Error).message}`)
    }
    return map
  }

  // Bài ẩn danh: che tác giả với mọi người; isMine cho chủ bài tự nhận ra
  // Anonymous posts mask the author for everyone; isMine lets the owner recognise it
  private mapRowToPostItem(row: any, poll?: PollData | null, viewerId?: string): PostItem {
    const anonymous = !!row.is_anonymous
    let postType: any = 'general'
    if (row.post_type === 'question' || row.post_type === 'qa') {
      postType = 'qa'
    } else if (row.post_type === 'resource_share' || row.post_type === 'document') {
      postType = 'document'
    } else if (row.post_type === 'pbl_recruitment' || row.post_type === 'group_recruit') {
      postType = 'group_recruit'
    } else if (row.post_type === 'review') {
      postType = 'review'
    } else {
      postType = 'general'
    }

    return {
      id: row.id,
      authorId: anonymous ? anonymousAuthor().id : row.author_id,
      author: anonymous
        ? anonymousAuthor()
        : {
            id: row.author_user_id || row.author_id,
            username: row.author_username || 'user',
            displayName: row.author_display_name || 'Sinh viên Phenikaa',
            avatarUrl: row.author_avatar_url || null,
            role: row.author_role || 'student',
            faculty: row.author_faculty || null,
            reputationPoints: row.author_reputation_points || 100
          },
      isAnonymous: anonymous,
      isMine: !!viewerId && row.author_id === viewerId,
      title: row.title,
      content: row.content,
      postType,
      courseId: row.course_id,
      courseCode: row.course_code || null,
      courseName: row.course_name || null,
      communityId: row.community_id || null,
      communitySlug: row.community_slug || null,
      communityName: row.community_name || null,
      facultyCode: row.faculty_code || (anonymous ? null : row.author_faculty) || null,
      targetAudience: 'everyone',
      visibility: VISIBILITIES.includes(row.visibility) ? row.visibility : 'public',
      archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
      isPinned: !!row.is_pinned,
      isResolved: row.is_resolved || false,
      tags: row.tags || [],
      mediaUrls: row.media_urls || [],
      attachedDocumentIds: row.attached_document_ids || [],
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      sharesCount: row.shares_count || 0,
      isLikedByMe: row.is_liked_by_me || false,
      isBookmarkedByMe: row.is_bookmarked_by_me || false,
      isAuthorFollowedByMe: !anonymous && !!row.is_author_followed_by_me,
      poll: poll || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }
  }
}
