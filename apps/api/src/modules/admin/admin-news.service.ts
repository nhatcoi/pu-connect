import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type {
  NewsArticle,
  NewsArticlePublishInput,
  NewsCategory,
  NewsConfigInput,
  NewsCrawlerConfig,
  NewsOverview,
  NewsSource,
  NewsSourceInput,
  NewsStatus
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { LlmService } from '../ai/llm.service'
import { writeAudit } from './admin-audit'

@Injectable()
export class AdminNewsService {
  private readonly logger = new Logger(AdminNewsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService
  ) {}

  // Lấy tổng quan: số liệu, danh sách bài viết, nguồn tin, cấu hình và bot có sẵn
  async overview(): Promise<NewsOverview> {
    const [statsRes, sourcesRes, articlesRes, configRes, botsRes] = await Promise.all([
      this.db.query(`
        SELECT 
          COUNT(*)::int AS total_articles,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_articles,
          COUNT(*) FILTER (WHERE status = 'posted')::int AS posted_articles,
          (SELECT COUNT(*)::int FROM news_sources) AS total_sources
        FROM news_articles
      `),
      this.db.query(`
        SELECT id, name, url, category, enabled, last_run_at, items_count, created_at
        FROM news_sources
        ORDER BY id ASC
      `),
      this.db.query(`
        SELECT 
          id, source_id, source_name, source_url, title, summary, impact,
          category, status, published_at, post_id, posted_by, posted_at, created_at
        FROM news_articles
        ORDER BY created_at DESC
        LIMIT 100
      `),
      this.db.query(`
        SELECT auto_post, telegram_enabled, telegram_bot_token, telegram_chat_id, default_bot, ai_model, updated_at
        FROM news_crawler_config
        WHERE id = 1
      `),
      this.db.query(`
        SELECT username, display_name
        FROM users
        WHERE is_bot = true AND status = 'active'
        ORDER BY display_name ASC
      `)
    ])

    const statsRow = statsRes.rows[0] || {}
    const configRow = configRes.rows[0] || {
      auto_post: false,
      telegram_enabled: false,
      telegram_bot_token: null,
      telegram_chat_id: null,
      default_bot: 'ainews',
      ai_model: 'n7ai-per',
      updated_at: new Date().toISOString()
    }

    const sources: NewsSource[] = sourcesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      category: r.category as NewsCategory,
      enabled: r.enabled,
      lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
      itemsCount: r.items_count,
      createdAt: new Date(r.created_at).toISOString()
    }))

    const articles: NewsArticle[] = articlesRes.rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_name,
      sourceUrl: r.source_url,
      title: r.title,
      summary: r.summary,
      impact: r.impact,
      category: r.category as NewsCategory,
      status: r.status as NewsStatus,
      publishedAt: new Date(r.published_at).toISOString(),
      createdAt: new Date(r.created_at).toISOString(),
      postId: r.post_id,
      postedBy: r.posted_by,
      postedAt: r.posted_at ? new Date(r.posted_at).toISOString() : null
    }))

    const config: NewsCrawlerConfig = {
      autoPost: configRow.auto_post,
      telegramEnabled: configRow.telegram_enabled,
      telegramBotToken: configRow.telegram_bot_token,
      telegramChatId: configRow.telegram_chat_id,
      defaultBot: configRow.default_bot,
      aiModel: configRow.ai_model,
      updatedAt: new Date(configRow.updated_at).toISOString()
    }

    const availableBots = botsRes.rows.map((r) => ({
      username: r.username,
      displayName: r.display_name
    }))

    return {
      stats: {
        totalArticles: statsRow.total_articles ?? 0,
        pendingArticles: statsRow.pending_articles ?? 0,
        postedArticles: statsRow.posted_articles ?? 0,
        totalSources: statsRow.total_sources ?? 0
      },
      sources,
      articles,
      config,
      availableBots
    }
  }

  // Thu thập tin tức từ các nguồn RSS đang bật và dùng AI tóm tắt
  async fetchNews(adminId: string): Promise<{ fetched: number; newItems: number }> {
    const [sourcesRes, configRes] = await Promise.all([
      this.db.query(`SELECT id, name, url, category FROM news_sources WHERE enabled = true`),
      this.db.query(`SELECT auto_post, telegram_enabled, telegram_bot_token, telegram_chat_id, default_bot FROM news_crawler_config WHERE id = 1`)
    ])

    const sources = sourcesRes.rows
    const config = configRes.rows[0] || {}
    let totalNew = 0

    for (const src of sources) {
      try {
        const rawItems = await this.parseRss(src.url)
        let srcNewCount = 0

        for (const item of rawItems) {
          if (!item.link || !item.title) continue

          // Kiểm tra URL đã thu thập chưa
          const exists = await this.db.query(`SELECT 1 FROM news_articles WHERE source_url = $1`, [item.link])
          if (exists.rowCount) continue

          // AI Summarize & Format sang tiếng Việt
          const aiResult = await this.summarizeWithAi(item.title, item.description || item.title, src.category)

          // Lưu bài viết vào cơ sở dữ liệu
          const insertRes = await this.db.query(
            `INSERT INTO news_articles (
              source_id, source_name, source_url, title, summary, impact, category, status, published_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
              src.id,
              src.name,
              item.link,
              aiResult.title,
              aiResult.summary,
              aiResult.impact,
              aiResult.category,
              'pending',
              item.pubDate ? new Date(item.pubDate) : new Date()
            ]
          )

          srcNewCount++
          totalNew++

          const newArticleId = insertRes.rows[0].id

          // Gửi thông báo tới Telegram Monitor nếu bật
          if (config.telegram_enabled && config.telegram_bot_token && config.telegram_chat_id) {
            await this.sendTelegramNotification(config.telegram_bot_token, config.telegram_chat_id, {
              title: aiResult.title,
              summary: aiResult.summary,
              impact: aiResult.impact,
              source: src.name,
              url: item.link
            }).catch((e) => this.logger.warn(`Lỗi gửi Telegram: ${e.message}`))
          }

          // Tự động đăng nếu bật mode auto_post
          if (config.auto_post) {
            await this.publishArticle(adminId, newArticleId, { bot: config.default_bot }).catch((e) =>
              this.logger.error(`Lỗi tự động đăng bài ${newArticleId}: ${e.message}`)
            )
          }

          // Giới hạn xử lý tối đa 4 bài mỗi nguồn mỗi lần quét để tránh nghẽn
          if (srcNewCount >= 4) break
        }

        await this.db.query(
          `UPDATE news_sources SET last_run_at = NOW(), items_count = items_count + $1 WHERE id = $2`,
          [srcNewCount, src.id]
        )
      } catch (err: any) {
        this.logger.warn(`Lỗi khi quét nguồn ${src.name} (${src.url}): ${err.message}`)
      }
    }

    await this.db.transaction((client) =>
      writeAudit(client, adminId, {
        action: 'news.fetch',
        targetType: 'system',
        targetId: 'news_crawler',
        details: { fetchedSources: sources.length, newItems: totalNew }
      })
    )

    return { fetched: sources.length, newItems: totalNew }
  }

  // Đăng bài viết lên PUC dưới danh nghĩa Bot
  async publishArticle(adminId: string, articleId: string, input?: NewsArticlePublishInput) {
    return this.db.transaction(async (client) => {
      const artRes = await client.query(`SELECT * FROM news_articles WHERE id = $1 FOR UPDATE`, [articleId])
      if (!artRes.rowCount) throw new NotFoundException('Không tìm thấy bài viết tin tức')
      const article = artRes.rows[0]

      const targetBot = input?.bot || 'ainews'
      const botRes = await client.query(`SELECT id, username, display_name FROM users WHERE username = $1 AND is_bot = true`, [targetBot])
      if (!botRes.rowCount) throw new BadRequestException(`Không tìm thấy Bot @${targetBot}`)
      const bot = botRes.rows[0]

      // Format bài đăng Markdown có dẫn nguồn
      const postContent = `### ${article.title}

${article.summary}

${article.impact ? `💡 **Tác động:** ${article.impact}\n\n` : ''}📌 **Nguồn tin:** [${article.source_name}](${article.source_url})`

      const postRes = await client.query(
        `INSERT INTO posts (id, author_id, content, type, visibility, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'text', 'public', NOW(), NOW()) RETURNING id`,
        [bot.id, postContent]
      )

      const postId = postRes.rows[0].id

      await client.query(
        `UPDATE news_articles 
         SET status = 'posted', post_id = $1, posted_by = $2, posted_at = NOW() 
         WHERE id = $3`,
        [postId, bot.username, articleId]
      )

      await writeAudit(client, adminId, {
        action: 'news.publish',
        targetType: 'bot',
        targetId: articleId,
        details: { postId, bot: bot.username }
      })

      return { success: true, postId }
    })
  }

  // Đổi trạng thái bài viết (Duyệt / Từ chối / Chờ)
  async updateStatus(adminId: string, articleId: string, status: NewsStatus) {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE news_articles SET status = $1 WHERE id = $2 RETURNING id`,
        [status, articleId]
      )
      if (!res.rowCount) throw new NotFoundException('Không tìm thấy bài viết')

      await writeAudit(client, adminId, {
        action: 'news.status_change',
        targetType: 'bot',
        targetId: articleId,
        details: { status }
      })
    })

    return { success: true }
  }

  // Thêm nguồn tin mới
  async createSource(adminId: string, input: NewsSourceInput) {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `INSERT INTO news_sources (name, url, category, enabled)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [input.name, input.url, input.category, input.enabled]
      )
      await writeAudit(client, adminId, {
        action: 'news.source_create',
        targetType: 'system',
        targetId: String(res.rows[0].id),
        details: { ...input }
      })
    })
    return this.overview()
  }

  // Cập nhật nguồn tin
  async updateSource(adminId: string, id: number, input: Partial<NewsSourceInput>) {
    const fields: string[] = []
    const params: any[] = [id]
    let pIdx = 2

    if (input.name !== undefined) {
      fields.push(`name = $${pIdx++}`)
      params.push(input.name)
    }
    if (input.url !== undefined) {
      fields.push(`url = $${pIdx++}`)
      params.push(input.url)
    }
    if (input.category !== undefined) {
      fields.push(`category = $${pIdx++}`)
      params.push(input.category)
    }
    if (input.enabled !== undefined) {
      fields.push(`enabled = $${pIdx++}`)
      params.push(input.enabled)
    }

    if (fields.length === 0) return this.overview()

    await this.db.transaction(async (client) => {
      await client.query(`UPDATE news_sources SET ${fields.join(', ')} WHERE id = $1`, params)
      await writeAudit(client, adminId, {
        action: 'news.source_update',
        targetType: 'system',
        targetId: String(id),
        details: { ...input }
      })
    })
    return this.overview()
  }

  // Xóa nguồn tin
  async deleteSource(adminId: string, id: number) {
    await this.db.transaction(async (client) => {
      await client.query(`DELETE FROM news_sources WHERE id = $1`, [id])
      await writeAudit(client, adminId, {
        action: 'news.source_delete',
        targetType: 'system',
        targetId: String(id)
      })
    })
    return this.overview()
  }

  // Cập nhật cấu hình
  async updateConfig(adminId: string, input: NewsConfigInput) {
    const fields: string[] = ['updated_at = NOW()']
    const params: any[] = []
    let pIdx = 1

    if (input.autoPost !== undefined) {
      fields.push(`auto_post = $${pIdx++}`)
      params.push(input.autoPost)
    }
    if (input.telegramEnabled !== undefined) {
      fields.push(`telegram_enabled = $${pIdx++}`)
      params.push(input.telegramEnabled)
    }
    if (input.telegramBotToken !== undefined) {
      fields.push(`telegram_bot_token = $${pIdx++}`)
      params.push(input.telegramBotToken)
    }
    if (input.telegramChatId !== undefined) {
      fields.push(`telegram_chat_id = $${pIdx++}`)
      params.push(input.telegramChatId)
    }
    if (input.defaultBot !== undefined) {
      fields.push(`default_bot = $${pIdx++}`)
      params.push(input.defaultBot)
    }
    if (input.aiModel !== undefined) {
      fields.push(`ai_model = $${pIdx++}`)
      params.push(input.aiModel)
    }

    await this.db.transaction(async (client) => {
      await client.query(`UPDATE news_crawler_config SET ${fields.join(', ')} WHERE id = 1`, params)
      await writeAudit(client, adminId, {
        action: 'news.config_update',
        targetType: 'system',
        targetId: 'crawler_config',
        details: { ...input }
      })
    })
    return this.overview()
  }

  // Phân tích RSS XML đơn giản bằng regex
  private async parseRss(url: string): Promise<Array<{ title: string; link: string; pubDate?: string; description?: string }>> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PU ConnectNewsBot/1.0 (Mozilla/5.0; compatible)'
      },
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const xml = await res.text()
    const items: Array<{ title: string; link: string; pubDate?: string; description?: string }> = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi
    let match

    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const block = match[1]
      const title = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || ''
      const link = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || ''
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || ''
      const description = (block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || ''

      const cleanTitle = title.replace(/<[^>]+>/g, '').trim()
      const cleanDesc = description.replace(/<[^>]+>/g, '').trim()
      const cleanLink = link.trim()

      if (cleanTitle && cleanLink) {
        items.push({
          title: cleanTitle,
          link: cleanLink,
          pubDate: pubDate.trim(),
          description: cleanDesc
        })
      }
    }

    return items
  }

  // Tóm tắt & Dịch bài báo sang tiếng Việt qua LLM
  private async summarizeWithAi(
    title: string,
    content: string,
    fallbackCategory: NewsCategory
  ): Promise<{ title: string; summary: string; impact: string; category: NewsCategory }> {
    const systemPrompt = `Bạn là biên tập viên tin tức công nghệ và AI hàng đầu. 
Nhiệm vụ: Dịch và tóm tắt bài báo sau sang tiếng Việt chuẩn mực, súc tích và khách quan.
Trả về DUY NHẤT một JSON hợp lệ dạng:
{
  "title": "Tiêu đề tiếng Việt ngắn gọn, hấp dẫn, chuẩn chuyên môn",
  "summary": "Tóm tắt 2-3 câu nêu bật sự kiện chính",
  "impact": "Tác động hoặc hàm ý công nghệ/doanh nghiệp/người dùng (1-2 câu)",
  "category": "ai" | "security" | "robotics" | "tech" | "general"
}`

    const userPrompt = `Tiêu đề gốc: ${title}
Nội dung: ${content.slice(0, 1500)}`

    try {
      const { text } = await this.llm.complete([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])
      const cleaned = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim()
      const parsed = JSON.parse(cleaned)

      return {
        title: parsed.title || title,
        summary: parsed.summary || content.slice(0, 200),
        impact: parsed.impact || '',
        category: (['ai', 'security', 'robotics', 'tech', 'general'].includes(parsed.category) ? parsed.category : fallbackCategory) as NewsCategory
      }
    } catch {
      return {
        title,
        summary: content.slice(0, 250),
        impact: '',
        category: fallbackCategory
      }
    }
  }

  // Gửi thông báo bản tin mới tới Telegram Monitor
  private async sendTelegramNotification(
    token: string,
    chatId: string,
    data: { title: string; summary: string; impact: string; source: string; url: string }
  ) {
    const text = `📰 *BẢN TIN MỚI (${data.source})*

*${data.title}*

${data.summary}

${data.impact ? `💡 *Tác động:* ${data.impact}\n` : ''}🔗 [Xem bài gốc](${data.url})`

    const telegramApi = `https://api.telegram.org/bot${token}/sendMessage`
    await fetch(telegramApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      }),
      signal: AbortSignal.timeout(5000)
    })
  }
}
