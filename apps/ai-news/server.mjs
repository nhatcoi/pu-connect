import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5060

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const TOPIC_QUERIES = {
  ai: 'Artificial Intelligence AI OR OpenAI OR Anthropic OR Gemini',
  tech: 'Technology OR Software OR "Công nghệ thông tin" OR Hardware',
  politics: 'World Politics OR "Chính trị quốc tế" OR Diplomacy OR Summit',
  economy: 'Global Economy OR "Kinh tế" OR "Thị trường tài chính" OR Stock',
  security: 'Cybersecurity OR "An ninh mạng" OR "Lỗ hổng bảo mật" OR Ransomware',
  robotics: 'Robotics OR "Robot tự hành" OR "Hình người" OR Automation',
  science: 'Science OR "Khoa học vũ trụ" OR Physics OR Biotechnology'
}

// 1. Tìm kiếm & Crawl RSS tin tức
app.post('/api/search', async (req, res) => {
  try {
    const { topic = 'ai', query = '', lang = 'en', limit = 10 } = req.body
    let searchQuery = query.trim()
    if (!searchQuery && TOPIC_QUERIES[topic]) {
      searchQuery = TOPIC_QUERIES[topic]
    } else if (!searchQuery) {
      searchQuery = 'Technology AI'
    }

    const hl = lang === 'vi' ? 'vi-VN' : 'en-US'
    const gl = lang === 'vi' ? 'VN' : 'US'
    const ceid = lang === 'vi' ? 'VN:vi' : 'US:en'

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=${hl}&gl=${gl}&ceid=${ceid}`

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(12000)
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `Lỗi fetch Google RSS: HTTP ${response.status}` })
    }

    const xml = await response.text()
    const items = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi
    let match

    while ((match = itemRegex.exec(xml)) !== null && items.length < Number(limit)) {
      const block = match[1]
      const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || ''
      const link = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || ''
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || ''
      const description = (block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || ''

      // Tách tên nguồn từ title của Google News: "Title text - Publisher Name"
      let title = rawTitle.replace(/<[^>]+>/g, '').trim()
      let sourceName = 'Tin tức quốc tế'
      const lastDash = title.lastIndexOf(' - ')
      if (lastDash > 0) {
        sourceName = title.slice(lastDash + 3).trim()
        title = title.slice(0, lastDash).trim()
      }

      // Tìm ảnh đại diện từ media hoặc description
      let imageUrl = null
      const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i) || block.match(/url=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i)
      if (imgMatch) {
        imageUrl = imgMatch[1]
      }

      // Làm sạch snippet text
      const cleanSnippet = description.replace(/<[^>]+>/g, '').trim()

      if (title && link) {
        items.push({
          id: `item_${Date.now()}_${items.length}`,
          title,
          originalTitle: title,
          link: link.trim(),
          sourceName,
          pubDate: pubDate.trim(),
          snippet: cleanSnippet,
          imageUrl,
          topic
        })
      }
    }

    return res.json({ articles: items })
  } catch (err) {
    console.error('Search error:', err)
    return res.status(500).json({ error: err.message || 'Lỗi khi thu thập tin tức' })
  }
})

// 2. AI Tóm tắt & Chuẩn hóa sang Tiếng Việt
app.post('/api/summarize', async (req, res) => {
  try {
    const { articles = [], config = {} } = req.body
    if (!articles.length) return res.json({ articles: [] })

    const baseUrl = (config.baseUrl || 'https://api-ai.vnhat.dev/v1').replace(/\/$/, '')
    const model = config.model || 'n7ai-per'
    const apiKey = config.apiKey || ''

    const systemPrompt = `Bạn là biên tập viên tin tức cao cấp chuyên nghiệp.
Nhiệm vụ: Nhận danh sách các bài báo tiếng Anh/quốc tế, dịch và biên tập sang tiếng Việt chuẩn mực, súc tích, khách quan.
Với mỗi bài báo, hãy trả về đúng định dạng JSON:
{
  "results": [
    {
      "index": 0,
      "title": "Tiêu đề tiếng Việt ngắn gọn, hấp dẫn, chuẩn ngữ nghĩa",
      "summary": "Tóm tắt 2-3 câu nêu bật sự kiện chính, số liệu quan trọng",
      "impact": "Tác động hoặc hàm ý công nghệ/thị trường/xã hội (1-2 câu)",
      "category": "Lĩnh vực (vd: AI, Tech, Chính trị, Kinh tế, An ninh mạng, Robotics...)"
    }
  ]
}
Chỉ trả về DUY NHẤT một khối JSON hợp lệ, không giải thích gì thêm.`

    const articlesPayload = articles.map((a, idx) => ({
      index: idx,
      title: a.title,
      snippet: a.snippet || a.title
    }))

    const userPrompt = `Hãy dịch và tóm tắt danh sách ${articles.length} bài báo sau:\n${JSON.stringify(articlesPayload, null, 2)}`

    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const llmRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(45000)
    })

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      return res.status(llmRes.status).json({ error: `Lỗi gọi LLM (${model}): ${errText.slice(0, 300)}` })
    }

    const llmData = await llmRes.json()
    const content = llmData.choices?.[0]?.message?.content || ''
    const cleaned = content.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim()

    let parsed = { results: [] }
    try {
      parsed = JSON.parse(cleaned)
    } catch (e) {
      console.warn('Cannot parse LLM response JSON:', cleaned)
    }

    const resultMap = new Map()
    if (Array.isArray(parsed.results)) {
      for (const r of parsed.results) {
        resultMap.set(r.index, r)
      }
    }

    const enriched = articles.map((a, idx) => {
      const aiData = resultMap.get(idx)
      return {
        ...a,
        title: aiData?.title || a.title,
        summary: aiData?.summary || a.snippet || a.title,
        impact: aiData?.impact || '',
        category: aiData?.category || a.topic || 'Tin tức'
      }
    })

    return res.json({ articles: enriched })
  } catch (err) {
    console.error('Summarize error:', err)
    return res.status(500).json({ error: err.message || 'Lỗi khi gọi AI tóm tắt' })
  }
})

// 3. Gửi bài viết / Bản tin qua Telegram
app.post('/api/telegram', async (req, res) => {
  try {
    const { botToken, chatId, article, digest } = req.body

    if (!botToken || !chatId) {
      return res.status(400).json({ error: 'Thiếu Telegram Bot Token hoặc Chat ID' })
    }

    // Gửi 1 bài viết riêng
    if (article) {
      const text = `📰 *${escapeMarkdown(article.title)}*

${escapeMarkdown(article.summary)}

${article.impact ? `💡 *Tác động:* ${escapeMarkdown(article.impact)}\n` : ''}📌 *Nguồn:* ${escapeMarkdown(article.sourceName)} · ${escapeMarkdown(article.category || 'Tin tức')}
🔗 [Xem bài gốc](${article.link})`

      const replyMarkup = {
        inline_keyboard: [[{ text: '🔗 Đọc bài viết gốc', url: article.link }]]
      }

      if (article.imageUrl && (article.imageUrl.startsWith('http://') || article.imageUrl.startsWith('https://'))) {
        const photoRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: article.imageUrl,
            caption: text.slice(0, 1024),
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          })
        })
        const photoData = await photoRes.json()
        if (photoData.ok) return res.json({ success: true })
      }

      // Fallback gửi tin nhắn text thường nếu không có ảnh hoặc lỗi gửi ảnh
      const msgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
          disable_web_page_preview: false
        })
      })
      const msgData = await msgRes.json()
      if (!msgData.ok) {
        return res.status(400).json({ error: msgData.description || 'Lỗi từ Telegram API' })
      }
      return res.json({ success: true })
    }

    // Gửi toàn bộ danh sách bài viết dưới dạng Digest tổng hợp
    if (Array.isArray(digest) && digest.length > 0) {
      let digestText = `🗞️ *BẢN TIN TỔNG HỢP AI & CÔNG NGHỆ*\n_${new Date().toLocaleDateString('vi-VN')} · Tổng hợp ${digest.length} tin tức_\n\n`

      digest.forEach((a, idx) => {
        digestText += `*${idx + 1}. ${escapeMarkdown(a.title)}*\n`
        digestText += `${escapeMarkdown(a.summary)}\n`
        if (a.impact) digestText += `💡 _Tác động:_ ${escapeMarkdown(a.impact)}\n`
        digestText += `🔗 [${escapeMarkdown(a.sourceName)}](${a.link})\n\n`
      })

      const msgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: digestText.slice(0, 4096),
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      })
      const msgData = await msgRes.json()
      if (!msgData.ok) {
        return res.status(400).json({ error: msgData.description || 'Lỗi gửi Digest Telegram' })
      }
      return res.json({ success: true })
    }

    return res.status(400).json({ error: 'Không có dữ liệu bài viết để gửi' })
  } catch (err) {
    console.error('Telegram error:', err)
    return res.status(500).json({ error: err.message || 'Lỗi gửi Telegram' })
  }
})

function escapeMarkdown(text = '') {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
}

// Phục vụ frontend static nếu chạy ở chế độ production
app.use(express.static(path.join(__dirname, 'dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AI News Aggregator Server running at http://0.0.0.0:${PORT}`)
})
