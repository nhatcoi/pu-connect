import { logger } from './logger.mjs'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffled = (arr) => [...arr].sort(() => 0.5 - Math.random())

// Bot hoạt động trong khuôn khổ BotPolicy (quyền, chủ đề, hạn mức do admin đặt):
// chỉ đăng trong chủ đề được phép, chỉ tương tác bài liên quan, không chen vào bình luận của người thật.
export class BotScheduler {
  constructor(config, personas, clients, contentGen, policy) {
    this.config = config
    this.personas = new Map(personas.map((p) => [p.username, p]))
    this.clients = clients // Map<username, BotApiClient>
    this.contentGen = contentGen
    this.policy = policy
    // Bật/tắt & tốc độ do Admin điều khiển (ControlSync ghi vào đây); mặc định tạm dừng
    this.isPaused = true
    this.speed = config.simulation.speed || 'normal'
    this.isRunning = false
    this.queue = Promise.resolve()
    this.stats = { postsCount: 0, commentsCount: 0, likesCount: 0, startedAt: new Date() }
  }

  // Hệ số nhịp sinh học giờ Việt Nam (0.05 = ngủ, 1 = bình thường, >1 = cao điểm)
  getCircadianFactor() {
    if (!this.config.simulation.humanCircadianRhythm) return 1
    const vnHour = (new Date().getUTCHours() + 7) % 24
    if (vnHour >= 2 && vnHour < 6) return 0.05
    if (vnHour >= 6 && vnHour < 8) return 0.5
    if (vnHour >= 11 && vnHour <= 13) return 1.6
    if (vnHour >= 14 && vnHour < 18) return 0.8
    if (vnHour >= 19 && vnHour <= 23) return 1.8
    return 1
  }

  getNextIntervalMs() {
    const { minMinutes, maxMinutes } = this.config.simulation.intervals[this.speed] || this.config.simulation.intervals.normal
    const rawMs = (minMinutes + Math.random() * (maxMinutes - minMinutes)) * 60_000
    const factor = this.getCircadianFactor()
    return factor <= 0.1 ? rawMs * 5 : rawMs / factor
  }

  // Chạy tuần tự: vòng tự động và lệnh thủ công không đè lên nhau
  runExclusive(task) {
    const run = this.queue.then(task)
    this.queue = run.catch(() => {})
    return run
  }

  // Chọn hành động mà ít nhất một bot đang được phép làm
  async runStep() {
    if (this.getCircadianFactor() <= 0.1 && Math.random() > 0.05) return
    await this.policy.load(true)

    const w = this.config.simulation.actionWeights
    const options = []
    if (this.policy.eligible('post').length) options.push(['post', w.post])
    if (this.policy.eligible('comment').length || this.policy.eligible('like').length) options.push(['commentFeed', w.commentFeed])
    if (!options.length) return

    let r = Math.random() * options.reduce((sum, [, weight]) => sum + weight, 0)
    const [action] = options.find(([, weight]) => (r -= weight) <= 0) || options[0]
    try {
      if (action === 'post') await this.executePost()
      else await this.executeCommentFeed()
    } catch (err) {
      logger.error(`Lỗi hành động [${action}]:`, err)
    }
  }

  // 1. Bài tự sinh: đúng chủ đề được phép của bot (lệnh thủ công của admin bỏ qua hạn mức, vẫn cần bot đang bật)
  async executePost(targetUsername = null, hint = null) {
    await this.policy.load()
    const username = targetUsername || pick(this.policy.eligible('post'))
    if (!username) return
    const profile = this.policy.profiles.get(username)
    if (!profile?.enabled) throw new Error(`Bot @${username} đang bị tắt`)
    const topics = this.policy.topicsOf(username)
    if (!topics.length) throw new Error(`Bot @${username} chưa có chủ đề được phép`)

    const client = this.clients.get(username)
    const topic = pick(topics)
    logger.action(username, 'Posting', `Soạn bài chủ đề "${topic.label}"`)
    const postData = await this.contentGen.generatePost(this.personas.get(username), topic, hint)
    if (!postData) return logger.warn(`@${username}: LLM không sinh được bài, bỏ qua`)

    const post = await client.createPost({ title: postData.title, content: postData.content, tags: postData.tags })
    this.policy.record(username, 'post')
    this.stats.postsCount++
    logger.action(username, 'Post Success', `[${topic.slug}] "${postData.title.slice(0, 60)}"`)

    await this.crossBotInteraction(post, client, postData)
    return post
  }

  // Các bot khác (được phép + đúng chủ đề) phản hồi bài của bot: tối đa 2 tim, 1 bình luận, tác giả đáp lại
  async crossBotInteraction(post, authorClient, postData) {
    if (!post?.id) return
    const authorName = authorClient.persona.username
    const onTopic = (u) => this.policy.topicsOf(u).some((t) => t.slug === postData.topic) || this.policy.matchesTopics(u, postData.title, postData.content, postData.tags)
    const others = [...this.clients.keys()].filter((u) => u !== authorName && onTopic(u))

    for (const u of shuffled(others.filter((x) => this.policy.allows(x, 'like'))).slice(0, 2)) {
      await sleep(1000 + Math.random() * 2000)
      if (await this.likeOnce(this.clients.get(u), post.id)) logger.action(u, 'Liked Post', `Bài của @${authorName}`)
    }

    const commenter = shuffled(others.filter((x) => this.policy.allows(x, 'comment')))[0]
    if (!commenter) return
    await sleep(2500 + Math.random() * 3000)
    const text = await this.contentGen.generateComment(postData, this.personas.get(commenter), this.topicLabels(commenter))
    if (!text) return
    const comment = await this.clients.get(commenter).addComment(post.id, { content: text })
    this.policy.record(commenter, 'comment')
    this.stats.commentsCount++
    logger.action(commenter, 'Commented', `"${text}" vào bài @${authorName}`)

    if (comment?.id && this.policy.allows(authorName, 'comment') && Math.random() < 0.5) {
      await sleep(2500 + Math.random() * 2000)
      const reply = await this.contentGen.generateReply(postData, this.personas.get(authorName), comment, this.topicLabels(authorName))
      if (!reply) return
      await authorClient.addComment(post.id, { content: reply, parentId: comment.id })
      this.policy.record(authorName, 'comment')
      this.stats.commentsCount++
      logger.action(authorName, 'Author Reply', `"${reply}"`)
    }
  }

  topicLabels(username) {
    return this.policy.topicsOf(username).map((t) => t.label)
  }

  // Thả tim 1 lần (toggleLike sẽ bỏ tim nếu đã tim) — chỉ khi chưa tương tác bài này
  async likeOnce(client, postId) {
    if (await this.policy.hasEngaged(client.userId, postId)) return false
    const ok = await client.toggleLike(postId)
    if (ok) {
      this.policy.record(client.persona.username, 'like')
      this.stats.likesCount++
    }
    return ok
  }

  // 2. Lướt feed: chỉ bài liên quan chủ đề của bot; bài người thật chỉ khi bot được bật "tương tác người thật".
  // Không bao giờ trả lời bình luận của người thật.
  async executeCommentFeed(targetPostId = null, targetUsername = null) {
    await this.policy.load()
    const username = targetUsername || pick([...new Set([...this.policy.eligible('comment'), ...this.policy.eligible('like')])])
    if (!username) return
    const client = this.clients.get(username)
    const profile = this.policy.profiles.get(username)
    if (!client || !profile?.enabled) throw new Error(`Bot @${username} đang bị tắt`)
    const explicit = !!targetPostId // lệnh thủ công của admin: bỏ qua bộ lọc chủ đề/người thật và hạn mức

    let post
    if (explicit) {
      post = { id: targetPostId }
      const detail = (await client.getRecentPosts(50)).find((p) => p.id === targetPostId)
      if (detail) post = detail
    } else {
      const candidates = []
      for (const p of await client.getRecentPosts(25)) {
        if (p.author?.id === client.userId) continue
        if (!this.policy.isBotId(p.author?.id) && !profile.interact_humans) continue
        if (!this.policy.matchesTopics(username, p.title, p.content, p.tags)) continue
        if (await this.policy.hasEngaged(client.userId, p.id)) continue
        candidates.push(p)
      }
      post = pick(candidates)
      if (!post) return logger.info(`@${username}: không có bài phù hợp để tương tác`)
    }

    // AI đã bảo "không liên quan" (SKIP) thì cũng không thả tim
    let relevant = true
    if (explicit || this.policy.allows(username, 'comment')) {
      const text = await this.contentGen.generateComment(post, this.personas.get(username), this.topicLabels(username))
      relevant = !!text
      if (text) {
        await client.addComment(post.id, { content: text })
        this.policy.record(username, 'comment')
        this.stats.commentsCount++
        logger.action(username, 'Commented', `"${text}" vào bài [${String(post.title || post.content || post.id).slice(0, 40)}]`)
      }
    }

    if (relevant && this.policy.allows(username, 'like') && Math.random() < 0.7 && (await this.likeOnce(client, post.id))) {
      logger.action(username, 'Liked Post', `Bài ${String(post.id).slice(0, 8)}…`)
    }

    // Trả lời: chỉ bình luận của bot khác, trên bài của bot
    if (!explicit && this.policy.isBotId(post.author?.id) && this.policy.allows(username, 'comment') && Math.random() < 0.35) {
      const comments = (await client.getPostComments(post.id)).filter((c) => this.policy.isBotId(c.author?.id) && c.author?.id !== client.userId)
      const target = pick(comments)
      if (!target) return
      const reply = await this.contentGen.generateReply(post, this.personas.get(username), target, this.topicLabels(username))
      if (!reply) return
      await sleep(2000)
      await client.addComment(post.id, { content: reply, parentId: target.id })
      this.policy.record(username, 'comment')
      this.stats.commentsCount++
      logger.action(username, 'Replied Comment', `"${reply}" vào bình luận của bot @${target.author?.username ?? ''}`)
    }
  }

  async start() {
    this.isRunning = true
    logger.success('Scheduler đã khởi động (chờ Admin bật mô phỏng)')

    let nextRunAt = Date.now() + 5_000
    while (this.isRunning) {
      await sleep(1000)
      if (this.isPaused) {
        nextRunAt = Date.now() + 5_000 // vừa bật lại ⇒ chạy sau 5 giây
        continue
      }
      if (Date.now() < nextRunAt) continue

      await this.runExclusive(() => this.runStep())
      nextRunAt = Date.now() + this.getNextIntervalMs()
    }
  }

  stop() {
    this.isRunning = false
  }
}
