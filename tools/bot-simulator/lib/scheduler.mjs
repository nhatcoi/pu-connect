import { logger } from './logger.mjs'

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export class BotScheduler {
  constructor(config, personas, clients, contentGen) {
    this.config = config
    this.personas = personas
    this.clients = clients // Map<username, BotApiClient>
    this.contentGen = contentGen
    // Trạng thái bật/tắt & tốc độ do Admin điều khiển (ControlSync ghi vào đây); mặc định tạm dừng
    this.isPaused = true
    this.speed = config.simulation.speed || 'normal'
    this.isRunning = false
    this.queue = Promise.resolve()
    this.stats = {
      postsCount: 0,
      directChatsCount: 0,
      groupChatsCount: 0,
      commentsCount: 0,
      likesCount: 0,
      startedAt: new Date()
    }
  }

  // Lấy hệ số nhịp sinh học giờ Việt Nam (0.1 = ngủ, 1.0 = bình thường, 1.5 = giờ cao điểm)
  getCircadianFactor() {
    if (!this.config.simulation.humanCircadianRhythm) return 1.0
    const now = new Date()
    // Giờ VN = UTC + 7
    const vnHour = (now.getUTCHours() + 7) % 24

    if (vnHour >= 2 && vnHour < 6) return 0.05 // Đêm khuya: 95% đang ngủ
    if (vnHour >= 6 && vnHour < 8) return 0.5 // Sáng sớm
    if (vnHour >= 11 && vnHour <= 13) return 1.6 // Nghỉ trưa: lướt mạng, rủ ăn cơm
    if (vnHour >= 14 && vnHour < 18) return 0.8 // Giờ học chiều
    if (vnHour >= 19 && vnHour <= 23) return 1.8 // Tối: hoạt động cao điểm
    return 1.0
  }

  getNextIntervalMs() {
    const intervals = this.config.simulation.intervals[this.speed] || this.config.simulation.intervals.normal
    const minMs = intervals.minMinutes * 60_000
    const maxMs = intervals.maxMinutes * 60_000
    const rawMs = minMs + Math.random() * (maxMs - minMs)

    const factor = this.getCircadianFactor()
    if (factor <= 0.1) {
      // Giờ đi ngủ thì giãn cách lâu gấp 5 lần
      return rawMs * 5
    }
    // Giờ cao điểm thì khoảng cách ngắn hơn
    return rawMs / factor
  }

  pickAction() {
    const weights = this.config.simulation.actionWeights
    const total = weights.post + weights.directChat + weights.groupChat + weights.commentFeed
    const r = Math.random() * total

    let acc = 0
    if (r <= (acc += weights.post)) return 'post'
    if (r <= (acc += weights.directChat)) return 'directChat'
    if (r <= (acc += weights.groupChat)) return 'groupChat'
    return 'commentFeed'
  }

  getRandomClient(excludeUsername = null) {
    const list = this.personas.filter(p => p.username !== excludeUsername)
    const persona = list[Math.floor(Math.random() * list.length)]
    return this.clients.get(persona.username)
  }

  async runStep() {
    // Kiểm tra nếu đang nửa đêm và bot ngủ
    if (this.config.simulation.humanCircadianRhythm) {
      const factor = this.getCircadianFactor()
      if (factor <= 0.1 && Math.random() > 0.05) {
        logger.info('Hầu hết sinh viên đang ngủ (02:00 - 06:00), tạm nghỉ vòng này...')
        return
      }
    }

    const action = this.pickAction()
    try {
      switch (action) {
        case 'post':
          await this.executePost()
          break
        case 'directChat':
          await this.executeDirectChat()
          break
        case 'groupChat':
          await this.executeGroupChat()
          break
        case 'commentFeed':
          await this.executeCommentFeed()
          break
      }
    } catch (err) {
      logger.error(`Lỗi thực hiện hành động [${action}]:`, err)
    }
  }

  // 1. Thực hiện Đăng bài + Kích hoạt tương tác chéo giữa các bot
  async executePost(targetUsername = null, customTopic = null) {
    const authorClient = targetUsername ? this.clients.get(targetUsername) : this.getRandomClient()
    if (!authorClient) return

    logger.action(authorClient.persona.username, 'Posting', 'Đang soạn thảo bài viết phong phú...')
    const postData = await this.contentGen.generatePost(authorClient.persona, customTopic)
    if (!postData || !postData.content) return

    const createdPost = await authorClient.createPost(postData)
    this.stats.postsCount++
    const imgCount = (postData.mediaUrls || []).length
    const pollStr = postData.poll ? ' [Có Khảo sát]' : ''
    logger.action(
      authorClient.persona.username,
      'Post Success',
      `"${(postData.title || postData.content).slice(0, 45)}..." [Ảnh: ${imgCount}]${pollStr}`
    )

    // Kích hoạt tương tác qua lại tức thì từ các bot khác
    await this.simulateCrossBotInteraction(createdPost, authorClient, postData)

    return createdPost
  }

  // Tương tác đa chiều giữa các bot trên bài viết mới
  async simulateCrossBotInteraction(post, authorClient, postData) {
    if (!post || !post.id) return
    const otherClients = Array.from(this.clients.values()).filter(c => c.persona.username !== authorClient.persona.username)
    if (otherClients.length === 0) return

    // A. Thả tim: 2 - 3 bot vào like bài
    const likers = [...otherClients].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 2)
    for (const liker of likers) {
      await sleep(1000 + Math.random() * 2000)
      await liker.toggleLike(post.id)
      this.stats.likesCount++
      logger.action(liker.persona.username, 'Liked Post', `Thả tim bài viết của @${authorClient.persona.username}`)
    }

    // B. Tham gia khảo sát (Poll) nếu bài có bình chọn
    if (post.poll && Array.isArray(post.poll.options) && post.poll.options.length > 0) {
      const voters = [...otherClients].sort(() => 0.5 - Math.random()).slice(0, 3)
      for (const voter of voters) {
        const randomOpt = post.poll.options[Math.floor(Math.random() * post.poll.options.length)]
        if (randomOpt && randomOpt.id) {
          await sleep(1500 + Math.random() * 1500)
          await voter.votePoll(post.id, randomOpt.id)
          logger.action(voter.persona.username, 'Voted Poll', `Vote: "${randomOpt.optionText}"`)
        }
      }
    }

    // C. Bình luận: 1 - 2 bot vào để lại ý kiến
    const commentators = [...otherClients].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 1)
    let lastComment = null

    for (const commentator of commentators) {
      const delay = 2500 + Math.random() * 3000
      await sleep(delay)

      const commentText = await this.contentGen.generateComment(postData, commentator.persona)
      if (commentText) {
        try {
          lastComment = await commentator.addComment(post.id, { content: commentText })
          this.stats.commentsCount++
          logger.action(commentator.persona.username, 'Commented', `"${commentText}" vào bài @${authorClient.persona.username}`)
        } catch (err) {
          logger.warn(`Lỗi khi bình luận chéo: ${err.message}`)
        }
      }
    }

    // D. Tác giả trả lời bình luận (Thread reply) tạo cuộc đàm thoại
    if (lastComment && lastComment.id && Math.random() < 0.6) {
      await sleep(2500 + Math.random() * 2000)
      const replyText = await this.contentGen.generateAuthorReply(postData, authorClient.persona, lastComment)
      if (replyText) {
        try {
          await authorClient.addComment(post.id, { content: replyText, parentId: lastComment.id })
          this.stats.commentsCount++
          logger.action(authorClient.persona.username, 'Author Reply', `Phản hồi: "${replyText}"`)
        } catch (err) {
          logger.warn(`Lỗi phản hồi bình luận: ${err.message}`)
        }
      }
    }
  }

  // 2. Thực hiện Chat 1-1
  async executeDirectChat(usernameA = null, usernameB = null, customTopic = null) {
    const clientA = usernameA ? this.clients.get(usernameA) : this.getRandomClient()
    const clientB = usernameB ? this.clients.get(usernameB) : this.getRandomClient(clientA.persona.username)
    if (!clientA || !clientB) return

    logger.action(clientA.persona.username, 'Chat 1-1', `Bắt đầu cuộc trò chuyện với @${clientB.persona.username}`)
    
    // Mở conversation direct
    const convo = await clientA.openDirectConversation(clientB.userId)
    const convoId = convo.id

    // Sinh kịch bản
    const dialogue = await this.contentGen.generateDirectChat(clientA.persona, clientB.persona, customTopic)
    
    // Gửi lần lượt với delay gõ phím chân thực
    for (const msg of dialogue.script) {
      const activeClient = msg.fromA ? clientA : clientB
      const delay = (this.config.chatSettings.typingDelaySeconds.min + 
        Math.random() * (this.config.chatSettings.typingDelaySeconds.max - this.config.chatSettings.typingDelaySeconds.min)) * 1000

      await sleep(delay)
      await activeClient.sendMessage(convoId, msg.text)
      logger.action(activeClient.persona.username, 'Msg Sent', `[${dialogue.topic}] "${msg.text}"`)
    }

    this.stats.directChatsCount++
  }

  // 3. Thực hiện Group Chat
  async executeGroupChat(customTopic = null) {
    // Chọn 3-4 bots ngẫu nhiên
    const shuffled = [...this.personas].sort(() => 0.5 - Math.random())
    const members = shuffled.slice(0, 3)
    const ownerClient = this.clients.get(members[0].username)

    logger.action(ownerClient.persona.username, 'Group Chat', `Tổ chức chat nhóm giữa: ${members.map(m => '@' + m.username).join(', ')}`)

    const dialogue = await this.contentGen.generateGroupChat(members, customTopic)
    
    // Tạo nhóm hoặc dùng nhóm có sẵn
    const memberIds = members.map(m => this.clients.get(m.username).userId).filter(Boolean)
    const group = await ownerClient.createGroupConversation(dialogue.groupName, memberIds)
    const groupId = group.id

    for (const item of dialogue.script) {
      const member = members[item.role] || members[0]
      const client = this.clients.get(member.username)
      const delay = (this.config.chatSettings.typingDelaySeconds.min + 
        Math.random() * (this.config.chatSettings.typingDelaySeconds.max - this.config.chatSettings.typingDelaySeconds.min)) * 1000

      await sleep(delay)
      await client.sendMessage(groupId, item.text)
      logger.action(client.persona.username, 'Group Msg', `"${item.text}"`)
    }

    this.stats.groupChatsCount++
  }

  // 4. Lướt Feed & Bình luận/Like (Hỗ trợ thảo luận đa cấp)
  async executeCommentFeed(targetPostId = null, targetUsername = null) {
    const client = targetUsername ? this.clients.get(targetUsername) : this.getRandomClient()
    if (!client) return

    let post
    if (targetPostId) {
      post = { id: targetPostId, content: 'Bài viết được chỉ định' }
    } else {
      const posts = await client.getRecentPosts(15)
      if (!posts || posts.length === 0) return
      // Ưu tiên chọn bài của người khác (bao gồm cả các bot khác)
      const candidates = posts.filter(p => p.author?.id !== client.userId)
      post = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : posts[0]
    }

    // Like bài viết
    await client.toggleLike(post.id)
    this.stats.likesCount++
    logger.action(client.persona.username, 'Liked Post', `Post ID: ${post.id.slice(0, 8)}...`)

    // Kiểm tra xem bài có bình luận chưa để tạo luồng thảo luận lồng nhau
    const existingComments = await client.getPostComments(post.id)
    const shouldReply = Array.isArray(existingComments) && existingComments.length > 0 && Math.random() < 0.45

    if (shouldReply) {
      const targetComment = existingComments[Math.floor(Math.random() * existingComments.length)]
      const replyText = await this.contentGen.generateReplyComment(post, client.persona, targetComment)
      await sleep(2000)
      await client.addComment(post.id, { content: replyText, parentId: targetComment.id })
      this.stats.commentsCount++
      logger.action(client.persona.username, 'Replied Comment', `"${replyText}" vào bình luận của ${targetComment.author?.displayName || 'bạn học'}`)
    } else {
      const commentText = await this.contentGen.generateComment(post, client.persona)
      await sleep(2000)
      await client.addComment(post.id, { content: commentText })
      this.stats.commentsCount++
      logger.action(client.persona.username, 'Commented', `"${commentText}" vào bài [${(post.title || post.content || '').slice(0, 30)}...]`)
    }

    // Nếu có khảo sát và chưa vote -> tham gia bình chọn
    if (post.poll && Array.isArray(post.poll.options) && post.poll.options.length > 0 && !post.poll.hasVoted) {
      const randomOpt = post.poll.options[Math.floor(Math.random() * post.poll.options.length)]
      if (randomOpt && randomOpt.id) {
        await sleep(1500)
        await client.votePoll(post.id, randomOpt.id)
        logger.action(client.persona.username, 'Voted Poll', `Tham gia khảo sát: "${randomOpt.optionText}"`)
      }
    }
  }

  // Chạy tuần tự: vòng tự động và lệnh thủ công không đè lên nhau
  runExclusive(task) {
    const run = this.queue.then(task)
    this.queue = run.catch(() => {})
    return run
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
