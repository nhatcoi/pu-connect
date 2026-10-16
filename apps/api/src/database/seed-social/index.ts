// Seed mạng xã hội "trông thật": 20 persona + bài viết có ảnh, link, bình luận, cảm xúc, theo dõi
// Realistic social seed: personas, posts, comments, reactions, follows (idempotent)
//
// Dùng / Usage (apps/api):
//   pnpm seed:social                  → thêm persona + bài còn thiếu (chạy lại không trùng)
//   pnpm seed:social --reset          → xóa bài seed rồi nạp lại (giữ persona)
//   pnpm seed:social --purge-legacy   → xóa 100 tài khoản mẫu cũ (seed-users.sql) + dữ liệu của chúng
//   pnpm seed:social --print-assets   → in danh sách ảnh cần có trên R2 (seed/...)
// Env: DATABASE_URL, R2_PUBLIC_URL, SEED_PASSWORD (không đặt ⇒ persona không đăng nhập được bằng mật khẩu)
import { Pool, type PoolClient } from 'pg'
import * as bcrypt from 'bcryptjs'
import { PERSONAS } from './personas'
import { ALL_POSTS } from './posts'
import type { Persona, PostType, Reaction, SeedComment, SeedPost } from './types'

const SEED_EMAIL_DOMAIN = 'seed.pu-connector.test' // TLD .test: không bao giờ gửi được email thật
const SLUG_PREFIX = 'seed-'
const VN_OFFSET_MS = 7 * 3600_000
const DAY_MS = 86_400_000
// Dấu vân tay 100 tài khoản mẫu cũ (seed-users.sql): domain + hash mật khẩu dùng chung
const LEGACY_DOMAIN = 'phenikaa-uni.edu.vn'
const LEGACY_HASH = '$2b$10$yw7/tGEkCiXoDi/deRJay.JYcg1vmn/Kkt8fP/DGYk/1BHmyJKrNS'

const ASSET_BASE = `${(process.env.R2_PUBLIC_URL || 'https://pub-66e8a07080a74cb697df1ffbf74a4ecb.r2.dev').replace(/\/$/, '')}/seed`
const asset = {
  avatar: (file: string) => `${ASSET_BASE}/avatars/${file}`,
  banner: (id: number) => `${ASSET_BASE}/banners/${id}.jpg`,
  image: (id: number) => `${ASSET_BASE}/posts/${id}.jpg`
}

// ---------- Ngẫu nhiên có hạt giống (chạy lại ra cùng kết quả) / Seeded PRNG ----------
function rngFor(key: string) {
  let h = 2166136261
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Mốc thời gian theo giờ Việt Nam, không vượt quá hiện tại
function postTime(daysAgo: number, at: string, now: number): number {
  const [hh, mm] = at.split(':').map(Number)
  const vnDayStart = Math.floor((now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS
  const t = vnDayStart - daysAgo * DAY_MS + (hh * 60 + mm) * 60_000
  return Math.min(t, now - 5 * 60_000)
}

const clampTime = (t: number, floor: number, now: number) => Math.min(Math.max(t, floor), now - 60_000)

// Người tương tác: ưu tiên cùng sở thích với tác giả / Engagers weighted by topic overlap
function pickUsers(pool: Persona[], author: Persona, count: number, rnd: () => number): Persona[] {
  return pool
    .filter((p) => p.username !== author.username)
    .map((p) => ({ p, w: p.topics.filter((t) => author.topics.includes(t)).length + rnd() * 2 }))
    .sort((a, b) => b.w - a.w)
    .slice(0, Math.max(0, count))
    .map((x) => x.p)
}

function reactionFor(type: PostType | undefined, rnd: () => number): Reaction {
  const r = rnd()
  if ((type === 'question' || type === 'resource_share') && r < 0.4) return 'helpful'
  if (type === 'announcement' && r < 0.25) return 'celebrate'
  if (r < 0.12) return 'insightful'
  return 'like'
}

// ---------- Persona ----------
async function upsertPersonas(client: PoolClient, now: number): Promise<Map<string, { id: string; joinedAt: number }>> {
  const passwordHash = process.env.SEED_PASSWORD ? await bcrypt.hash(process.env.SEED_PASSWORD, 10) : null
  const ids = new Map<string, { id: string; joinedAt: number }>()
  for (const p of PERSONAS) {
    const joinedAt = now - p.joinedDaysAgo * DAY_MS
    const res = await client.query(
      `INSERT INTO users (email, username, password_hash, display_name, role, status, is_onboarded, email_verified, email_verified_at,
                          auth_provider, school, faculty, major, class_name, academic_year, student_id, bio, skills, interests,
                          location, avatar_url, banner_url, is_verified, verified_at, created_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, 'active', TRUE, TRUE, $6, 'local', 'Đại học Phenikaa', $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, CASE WHEN $18 THEN $6::timestamptz END, $6, $19)
       ON CONFLICT (username) DO UPDATE SET
         display_name = EXCLUDED.display_name, role = EXCLUDED.role, faculty = EXCLUDED.faculty, major = EXCLUDED.major,
         class_name = EXCLUDED.class_name, academic_year = EXCLUDED.academic_year, student_id = EXCLUDED.student_id,
         bio = EXCLUDED.bio, skills = EXCLUDED.skills, interests = EXCLUDED.interests, location = EXCLUDED.location,
         avatar_url = EXCLUDED.avatar_url, banner_url = EXCLUDED.banner_url, is_verified = EXCLUDED.is_verified,
         password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash), updated_at = NOW()
       RETURNING id, created_at`,
      [
        `${p.username}@${SEED_EMAIL_DOMAIN}`,
        p.username,
        passwordHash,
        p.displayName,
        p.role,
        new Date(joinedAt),
        p.faculty,
        p.major,
        p.className ?? null,
        p.academicYear ?? null,
        p.studentId ?? null,
        p.bio,
        p.skills,
        p.interests,
        p.location ?? null,
        asset.avatar(p.avatar),
        asset.banner(p.banner),
        p.verified,
        new Date(now - Math.floor(rngFor(p.username)() * 20) * 3600_000)
      ]
    )
    ids.set(p.username, { id: res.rows[0].id, joinedAt: new Date(res.rows[0].created_at).getTime() })
  }
  return ids
}

// ---------- Bài viết + tương tác ----------
async function insertPost(
  client: PoolClient,
  post: SeedPost,
  users: Map<string, { id: string; joinedAt: number }>,
  refs: { courses: Map<string, string>; communities: Map<string, string> },
  now: number
) {
  const author = PERSONAS.find((p) => p.username === post.by)
  const authorRef = users.get(post.by)
  if (!author || !authorRef) throw new Error(`Không có persona ${post.by} (bài ${post.key})`)
  const rnd = rngFor(post.key)
  const createdAt = clampTime(postTime(post.daysAgo, post.at, now), authorRef.joinedAt + DAY_MS, now)
  const courseId = post.course ? refs.courses.get(post.course) : undefined
  const communityId = post.community ? refs.communities.get(post.community) : undefined
  if (post.course && !courseId) throw new Error(`Không có học phần ${post.course} (bài ${post.key})`)
  if (post.community && !communityId) throw new Error(`Không có cộng đồng ${post.community} (bài ${post.key})`)

  const likers = pickUsers(PERSONAS, author, post.likes, rnd)
  const commentTotal = countComments(post.comments ?? [])
  const views = likers.length * (6 + Math.floor(rnd() * 9)) + commentTotal * 3 + Math.floor(rnd() * 20)

  const { rows } = await client.query(
    `INSERT INTO posts (author_id, course_id, community_id, post_type, title, slug, content, tags, media_urls, is_pinned, is_resolved,
                        views_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
     ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [
      authorRef.id,
      courseId ?? null,
      communityId ?? null,
      post.type ?? 'general',
      post.title ?? '',
      SLUG_PREFIX + post.key,
      post.content,
      post.tags ?? [],
      (post.images ?? []).map(asset.image),
      !!post.pinned,
      !!post.resolved,
      views,
      new Date(createdAt)
    ]
  )
  if (!rows[0]) return false // đã có ⇒ bỏ qua
  const postId: string = rows[0].id

  // Cảm xúc & lưu bài trong ~2 ngày sau khi đăng
  for (const u of likers) {
    const ref = users.get(u.username)!
    const at = clampTime(createdAt + rnd() * 2 * DAY_MS, ref.joinedAt, now)
    await client.query(`INSERT INTO post_reactions (post_id, user_id, reaction, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [
      postId,
      ref.id,
      reactionFor(post.type, rnd),
      new Date(at)
    ])
  }
  for (const u of pickUsers(PERSONAS, author, post.saves ?? 0, rnd)) {
    const ref = users.get(u.username)!
    await client.query(`INSERT INTO saved_posts (user_id, post_id, saved_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
      ref.id,
      postId,
      new Date(clampTime(createdAt + rnd() * 3 * DAY_MS, ref.joinedAt, now))
    ])
  }

  await insertComments(client, postId, post.comments ?? [], null, createdAt, users, now)
  if (post.poll) await insertPoll(client, postId, post, createdAt, users, now)
  return true
}

const countComments = (list: SeedComment[]): number => list.reduce((n, c) => n + 1 + countComments(c.replies ?? []), 0)

async function insertComments(
  client: PoolClient,
  postId: string,
  list: SeedComment[],
  parentId: string | null,
  parentAt: number,
  users: Map<string, { id: string; joinedAt: number }>,
  now: number
) {
  let prevAt = parentAt
  for (const c of list) {
    const ref = users.get(c.by)
    if (!ref) throw new Error(`Không có persona ${c.by} (bình luận)`)
    // Bình luận sau bài/cha `after` phút, giữ thứ tự tăng dần
    const at = clampTime(Math.max(parentAt + (c.after ?? 30) * 60_000, prevAt + 60_000), ref.joinedAt, now)
    prevAt = at
    const { rows } = await client.query(
      `INSERT INTO comments (post_id, author_id, parent_id, content, likes_count, is_solution, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
      [postId, ref.id, parentId, c.text, c.likes ?? 0, !!c.solution, new Date(at)]
    )
    if (c.replies?.length) await insertComments(client, postId, c.replies, rows[0].id, at, users, now)
  }
}

async function insertPoll(
  client: PoolClient,
  postId: string,
  post: SeedPost,
  createdAt: number,
  users: Map<string, { id: string; joinedAt: number }>,
  now: number
) {
  const poll = post.poll!
  const total = poll.votes.reduce((a, b) => a + b, 0)
  const expiresAt = createdAt + (poll.closesInDays ?? 7) * DAY_MS
  const { rows } = await client.query(
    `INSERT INTO post_polls (post_id, question, total_votes, expires_at, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [postId, poll.question, total, new Date(expiresAt), new Date(createdAt)]
  )
  const pollId: string = rows[0].id
  // Mỗi persona tối đa 1 phiếu: chia lần lượt theo danh sách đã xáo
  const rnd = rngFor(`${post.key}:poll`)
  const voters = [...PERSONAS].sort(() => rnd() - 0.5)
  let cursor = 0
  for (const [i, text] of poll.options.entries()) {
    const opt = await client.query(`INSERT INTO post_poll_options (poll_id, option_text, votes_count, display_order) VALUES ($1, $2, $3, $4) RETURNING id`, [
      pollId,
      text,
      poll.votes[i] ?? 0,
      i
    ])
    for (let k = 0; k < (poll.votes[i] ?? 0) && cursor < voters.length; k++, cursor++) {
      const ref = users.get(voters[cursor].username)!
      await client.query(`INSERT INTO post_poll_votes (poll_id, option_id, user_id, voted_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [
        pollId,
        opt.rows[0].id,
        ref.id,
        new Date(clampTime(createdAt + rnd() * DAY_MS, ref.joinedAt, Math.min(now, expiresAt)))
      ])
    }
  }
}

// ---------- Mạng theo dõi & cộng đồng ----------
async function seedFollows(client: PoolClient, users: Map<string, { id: string; joinedAt: number }>, now: number) {
  for (const a of PERSONAS) {
    const rnd = rngFor(`follow:${a.username}`)
    for (const b of PERSONAS) {
      if (a.username === b.username) continue
      const overlap = b.topics.filter((t) => a.topics.includes(t)).length
      const staff = b.role !== 'student' ? 0.25 : 0 // người mới hay theo dõi giảng viên, admin
      if (rnd() < 0.12 + overlap * 0.3 + staff) {
        const ra = users.get(a.username)!
        const rb = users.get(b.username)!
        const at = clampTime(Math.max(ra.joinedAt, rb.joinedAt) + rnd() * 10 * DAY_MS, 0, now)
        await client.query(`INSERT INTO user_follows (follower_id, following_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
          ra.id,
          rb.id,
          new Date(at)
        ])
      }
    }
  }
}

async function seedCommunityMembers(client: PoolClient, users: Map<string, { id: string; joinedAt: number }>, communities: Map<string, string>) {
  for (const [slug, communityId] of communities) {
    const rnd = rngFor(`community:${slug}`)
    for (const p of PERSONAS) {
      const posts = ALL_POSTS.some((x) => x.by === p.username && x.community === slug)
      if (!posts && slug !== 'phenikaa' && rnd() > 0.45) continue
      const role = p.role === 'admin' ? 'admin' : p.role === 'lecturer' || p.role === 'ta' ? 'moderator' : 'member'
      await client.query(`INSERT INTO community_members (community_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [
        communityId,
        users.get(p.username)!.id,
        role,
        new Date(users.get(p.username)!.joinedAt + DAY_MS)
      ])
    }
  }
}

// ---------- Dọn dữ liệu & đồng bộ bộ đếm ----------
async function purgeLegacy(client: PoolClient) {
  const legacy = `SELECT id FROM users WHERE split_part(email, '@', 2) = $1 AND password_hash = $2 AND account_type = 'human'`
  await client.query(`DELETE FROM study_groups WHERE leader_id IN (${legacy})`, [LEGACY_DOMAIN, LEGACY_HASH])
  // Chat 1-1 với tài khoản mẫu ⇒ xóa luôn (không để hội thoại một người)
  await client.query(
    `DELETE FROM conversations c WHERE c.type = 'direct'
       AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id IN (${legacy}))`,
    [LEGACY_DOMAIN, LEGACY_HASH]
  )
  const res = await client.query(`DELETE FROM users WHERE id IN (${legacy})`, [LEGACY_DOMAIN, LEGACY_HASH])
  console.log(`🧹 Đã xóa ${res.rowCount} tài khoản mẫu cũ (kèm bài, bình luận, cảm xúc của họ)`)
}

async function syncCounters(client: PoolClient) {
  await client.query(`UPDATE posts p SET
    likes_count = (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id),
    comments_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)`)
  await client.query(`UPDATE courses co SET post_count = (SELECT COUNT(*) FROM posts p WHERE p.course_id = co.id)`)
  await client.query(`UPDATE communities cm SET
    members_count = (SELECT COUNT(*) FROM community_members m WHERE m.community_id = cm.id),
    posts_count = (SELECT COUNT(*) FROM posts p WHERE p.community_id = cm.id)`)
  // Điểm uy tín persona: bài, lượt thích nhận được, lời giải được chọn
  await client.query(
    `UPDATE users u SET reputation_points = 100
       + 10 * (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id)
       + 2 * (SELECT COUNT(*) FROM post_reactions r JOIN posts p ON p.id = r.post_id WHERE p.author_id = u.id)
       + 15 * (SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id AND c.is_solution)
       + (SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id)
     WHERE split_part(u.email, '@', 2) = $1`,
    [SEED_EMAIL_DOMAIN]
  )
}

function printAssets() {
  const posts = [...new Set(ALL_POSTS.flatMap((p) => p.images ?? []))].sort((a, b) => a - b)
  console.log(JSON.stringify({ avatars: PERSONAS.map((p) => p.avatar), banners: PERSONAS.map((p) => p.banner), posts }))
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--print-assets')) return printAssets()

  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://pu_user:pu_password@localhost:5432/pu_connector_db' })
  const client = await pool.connect()
  const now = Date.now()
  try {
    await client.query('BEGIN')
    if (args.has('--purge-legacy')) await purgeLegacy(client)
    if (args.has('--reset')) {
      const res = await client.query(`DELETE FROM posts WHERE slug LIKE $1`, [`${SLUG_PREFIX}%`])
      console.log(`♻️  Đã xóa ${res.rowCount} bài seed cũ`)
    }

    const users = await upsertPersonas(client, now)
    const courses = new Map<string, string>((await client.query(`SELECT code, id FROM courses`)).rows.map((r) => [r.code, r.id]))
    const communities = new Map<string, string>((await client.query(`SELECT slug, id FROM communities`)).rows.map((r) => [r.slug, r.id]))

    let inserted = 0
    for (const post of ALL_POSTS) if (await insertPost(client, post, users, { courses, communities }, now)) inserted++
    await seedFollows(client, users, now)
    await seedCommunityMembers(client, users, communities)
    await syncCounters(client)
    await client.query('COMMIT')
    console.log(`✅ ${PERSONAS.length} persona · ${inserted}/${ALL_POSTS.length} bài mới`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('❌ Seed thất bại:', err)
  process.exit(1)
})
