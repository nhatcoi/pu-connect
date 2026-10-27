import type { StorageService } from '../src/modules/storage/storage.service'
import { DatabaseService } from '../src/database/database.service'
import type { LlmService } from '../src/modules/ai/llm.service'
import type { CommentsService } from '../src/modules/posts/comments.service'
import type { PostsService } from '../src/modules/posts/posts.service'
import { BotJobRunner } from '../src/modules/admin/bots/bot-job-runner.service'
import { BotJobsService } from '../src/modules/admin/bots/bot-jobs.service'
import { BotJobCreateSchema } from '../src/modules/admin/dto/admin-bots.dto'
import { createUser } from './helpers'

const LONG = (n: number) => `Nội dung bài sưu tầm số ${n} về lịch thi cuối kỳ và hướng dẫn đăng ký học phần.`

// Bot job (service + DB thật): nhập file, chống trùng, đăng theo lịch, bot tự trả lời/thả tim
describe('Bot jobs', () => {
  let db: DatabaseService
  let jobs: BotJobsService
  let runner: BotJobRunner
  let adminId: string
  let botId: string
  let botName: string
  const complete = jest.fn()

  // PostsService/CommentsService thật cần cả AppModule; ở đây chỉ ghi tối thiểu vào DB để kiểm tra luồng job
  const posts = {
    create: jest.fn(async (authorId: string, data: { title?: string; content: string }) => {
      const r = await db.query(`INSERT INTO posts (author_id, title, content) VALUES ($1, $2, $3) RETURNING id`, [authorId, data.title ?? '', data.content])
      return { id: r.rows[0].id }
    })
  }
  const comments = {
    create: jest.fn(async (authorId: string, data: { postId: string; parentId?: string; content: string }) => {
      await db.query(`INSERT INTO comments (post_id, author_id, parent_id, content) VALUES ($1, $2, $3, $4)`, [data.postId, authorId, data.parentId ?? null, data.content])
    }),
    toggleLike: jest.fn(async (commentId: string, userId: string) => {
      await db.query(`INSERT INTO comment_reactions (comment_id, user_id) VALUES ($1, $2)`, [commentId, userId])
    })
  }
  const storage = { publicUrlFor: () => 'https://cdn.test/', uploadFile: jest.fn() } as unknown as StorageService

  const input = (rows: Record<string, unknown>[], extra: Partial<Parameters<BotJobsService['create']>[1]> = {}) => ({
    name: 'Job thử',
    bot: botName,
    autoReply: true,
    autoReact: true,
    dryRun: false,
    rows,
    ...extra
  })

  beforeAll(async () => {
    db = new DatabaseService()
    jobs = new BotJobsService(db, storage)
    runner = new BotJobRunner(db, posts as unknown as PostsService, comments as unknown as CommentsService, { complete } as unknown as LlmService)
    adminId = (await createUser(db, { role: 'admin' })).id
    const bot = await createUser(db)
    botId = bot.id
    botName = bot.username
    await db.query(`UPDATE users SET is_bot = TRUE WHERE id = $1`, [botId])
    await db.query(`INSERT INTO bot_profiles (user_id, soul) VALUES ($1, 'Sinh viên vui tính')`, [botId])
  })
  beforeEach(async () => {
    await db.query(`DELETE FROM bot_jobs`)
    await db.query(`DELETE FROM posts WHERE author_id = $1`, [botId])
    jest.clearAllMocks()
  })
  afterAll(async () => {
    await db.query(`DELETE FROM bot_jobs`)
    await db.onModuleDestroy()
  })

  it('kiểm tra từng dòng, dryRun không ghi gì', async () => {
    const res = await jobs.create(adminId, input([{ content: LONG(1) }, { content: '' }, { content: LONG(1) }, { content: LONG(2), postType: 'khong-co' }, { content: LONG(3), course: 'KHONG-CO' }], { dryRun: true }))
    expect(res.summary).toEqual({ ok: 1, duplicate: 1, invalid: 3 })
    expect(res.rows.find((r) => r.index === 1)?.reason).toBe('thiếu nội dung')
    expect((await db.query(`SELECT 1 FROM bot_jobs`)).rowCount).toBe(0)
  })

  it('tạo job: giãn cách các bài không có giờ; chống trùng với job khác; bài lỗi không chặn cả lô', async () => {
    const res = await jobs.create(adminId, input([{ content: LONG(1), title: 'Bài 1', tags: ['a'] }, { content: LONG(2) }, { content: '' }], { spacingMinutes: 10 }))
    expect(res.summary).toEqual({ ok: 2, duplicate: 0, invalid: 1 })
    const rows = (await db.query(`SELECT scheduled_at FROM bot_job_posts WHERE job_id = $1 ORDER BY id`, [res.jobId])).rows
    expect(rows[1].scheduled_at.getTime() - rows[0].scheduled_at.getTime()).toBe(10 * 60_000)

    const again = await jobs.create(adminId, input([{ content: `  ${LONG(1).toUpperCase()} ` }, { content: LONG(9) }]))
    expect(again.summary).toEqual({ ok: 1, duplicate: 1, invalid: 0 })
    await expect(jobs.create(adminId, input([{ content: LONG(1) }]))).rejects.toThrow('Không có dòng hợp lệ')
  })

  it('đủ trường bài + khảo sát phải đủ cặp + bot phải tồn tại', async () => {
    const full = { content: LONG(5), title: 'T', images: [], tags: ['x', 'y'], postType: 'qa', visibility: 'followers', pollQuestion: 'Có?', pollOptions: ['Có', 'Không'] }
    const res = await jobs.create(adminId, input([full, { content: LONG(6), pollQuestion: 'Thiếu lựa chọn' }]))
    expect(res.summary).toMatchObject({ ok: 1, invalid: 1 })
    const data = (await db.query(`SELECT data FROM bot_job_posts WHERE job_id = $1`, [res.jobId])).rows[0].data
    expect(data).toMatchObject({ title: 'T', postType: 'qa', visibility: 'followers', tags: ['x', 'y'], pollQuestion: 'Có?', pollOptions: ['Có', 'Không'] })
    await expect(jobs.create(adminId, input([{ content: LONG(7) }], { bot: 'khong_co_bot' }))).rejects.toThrow('Không phải bot')
    expect(BotJobCreateSchema.safeParse(input([])).success).toBe(false)
  })

  it('runner đăng bài đến hạn, bỏ qua bài chưa tới giờ và job tạm dừng', async () => {
    const res = await jobs.create(adminId, input([{ content: LONG(11), title: 'Đến hạn' }, { content: LONG(12), scheduledAt: new Date(Date.now() + 3600_000).toISOString() }]))
    await runner.tick()
    const rows = (await db.query(`SELECT status, post_id FROM bot_job_posts WHERE job_id = $1 ORDER BY id`, [res.jobId])).rows
    expect(rows.map((r) => r.status)).toEqual(['posted', 'pending'])
    expect((await db.query(`SELECT author_id, title FROM posts WHERE id = $1`, [rows[0].post_id])).rows[0]).toMatchObject({ author_id: botId, title: 'Đến hạn' })

    const paused = await jobs.create(adminId, input([{ content: LONG(13) }]))
    await jobs.patch(adminId, paused.jobId!, { status: 'paused' })
    await runner.tick()
    expect((await db.query(`SELECT status FROM bot_job_posts WHERE job_id = $1`, [paused.jobId])).rows[0].status).toBe('pending')
  })

  it('đăng lỗi ⇒ failed kèm lý do; thử lại được; bỏ bài được', async () => {
    const res = await jobs.create(adminId, input([{ content: LONG(21) }]))
    posts.create.mockRejectedValueOnce(new Error('DB hỏng'))
    await runner.tick()
    const failed = (await db.query(`SELECT id, status, error FROM bot_job_posts WHERE job_id = $1`, [res.jobId])).rows[0]
    expect(failed).toMatchObject({ status: 'failed', error: 'DB hỏng' })

    await jobs.publishNow(adminId, res.jobId!, Number(failed.id))
    await runner.tick()
    expect((await db.query(`SELECT status FROM bot_job_posts WHERE id = $1`, [failed.id])).rows[0].status).toBe('posted')
    await expect(jobs.removePost(adminId, res.jobId!, Number(failed.id))).rejects.toThrow('Chỉ bỏ được')
  })

  it('bot trả lời + thả tim bình luận người thật đúng một lần; bỏ qua bot khác; SKIP thì không trả lời', async () => {
    const res = await jobs.create(adminId, input([{ content: LONG(31), title: 'Bài có bình luận' }]))
    await runner.tick()
    const postId = (await db.query(`SELECT post_id FROM bot_job_posts WHERE job_id = $1`, [res.jobId])).rows[0].post_id
    const human = await createUser(db)
    const other = await createUser(db)
    await db.query(`UPDATE users SET is_bot = TRUE WHERE id = $1`, [other.id])
    const old = `NOW() - INTERVAL '1 minute'`
    const c1 = (await db.query(`INSERT INTO comments (post_id, author_id, content, created_at) VALUES ($1, $2, 'Bài hay quá, khi nào thi vậy?', ${old}) RETURNING id`, [postId, human.id])).rows[0].id
    await db.query(`INSERT INTO comments (post_id, author_id, content, created_at) VALUES ($1, $2, 'Bot khác bình luận', ${old})`, [postId, other.id])
    const spam = (await db.query(`INSERT INTO comments (post_id, author_id, content, created_at) VALUES ($1, $2, 'mua hàng giá rẻ', ${old}) RETURNING id`, [postId, human.id])).rows[0].id
    await db.query(`INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, 'Vừa mới viết xong')`, [postId, human.id])

    complete.mockResolvedValueOnce({ text: '"Cuối tháng này nhé bạn!"', finishReason: 'stop' }).mockResolvedValueOnce({ text: 'SKIP', finishReason: 'stop' })
    await runner.tick()
    await runner.tick()

    expect(comments.create).toHaveBeenCalledTimes(1)
    expect(comments.create).toHaveBeenCalledWith(botId, expect.objectContaining({ postId, parentId: c1, content: 'Cuối tháng này nhé bạn!' }))
    expect(comments.toggleLike).toHaveBeenCalledTimes(2)
    expect(complete).toHaveBeenCalledTimes(2)
    expect(complete.mock.calls[0][0][0].content).toContain('Sinh viên vui tính')
    const handled = (await db.query(`SELECT comment_id, replied, reacted FROM bot_job_handled ORDER BY replied DESC`)).rows
    expect(handled).toHaveLength(2)
    expect(handled.find((h) => h.comment_id === c1)).toMatchObject({ replied: true, reacted: true })
    expect(handled.find((h) => h.comment_id === spam)).toMatchObject({ replied: false, reacted: true })
    expect((await jobs.list())[0]).toMatchObject({ replies: 1, reactions: 2 })
  })

  it('chỉ thả tim khi tắt tự trả lời; lỗi AI không làm hỏng vòng chạy', async () => {
    const res = await jobs.create(adminId, input([{ content: LONG(41) }]))
    await runner.tick()
    const postId = (await db.query(`SELECT post_id FROM bot_job_posts WHERE job_id = $1`, [res.jobId])).rows[0].post_id
    const human = await createUser(db)
    const ins = (text: string) => db.query(`INSERT INTO comments (post_id, author_id, content, created_at) VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute') RETURNING id`, [postId, human.id, text])

    await jobs.patch(adminId, res.jobId!, { autoReply: false })
    const a = (await ins('Bình luận A')).rows[0].id
    await runner.tick()
    expect(complete).not.toHaveBeenCalled()
    expect((await db.query(`SELECT replied, reacted FROM bot_job_handled WHERE comment_id = $1`, [a])).rows[0]).toEqual({ replied: false, reacted: true })

    await jobs.patch(adminId, res.jobId!, { autoReply: true })
    complete.mockRejectedValueOnce(new Error('LLM sập'))
    const b = (await ins('Bình luận B')).rows[0].id
    await runner.tick()
    expect((await db.query(`SELECT replied, error FROM bot_job_handled WHERE comment_id = $1`, [b])).rows[0]).toEqual({ replied: false, error: 'LLM sập' })
    expect(comments.create).not.toHaveBeenCalled()
  })

  it('xóa job giữ lại bài đã đăng', async () => {
    const res = await jobs.create(adminId, input([{ content: LONG(51) }, { content: LONG(52), scheduledAt: new Date(Date.now() + 3600_000).toISOString() }]))
    await runner.tick()
    await jobs.remove(adminId, res.jobId!)
    expect((await db.query(`SELECT 1 FROM posts WHERE author_id = $1`, [botId])).rowCount).toBe(1)
    expect((await db.query(`SELECT 1 FROM bot_job_posts WHERE job_id = $1`, [res.jobId])).rowCount).toBe(0)
  })
})
