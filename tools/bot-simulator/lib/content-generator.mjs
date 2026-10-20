import { sanitizeContent } from './content-sanitizer.mjs'
import { logger } from './logger.mjs'

const SKIP = 'SKIP'

// Sinh nội dung bằng LLM do admin cấu hình (Admin → Bot → AI). Không có mẫu dự phòng: LLM lỗi ⇒ bỏ qua, không đăng/bình luận.
export class ContentGenerator {
  constructor(config) {
    this.aiConfig = config.ai || {}
    this.safety = config.safety || { blockedKeywords: [] }
    this.runtime = {} // { baseUrl, model } do admin chọn, ControlSync cập nhật
  }

  setAi({ baseUrl, model }) {
    this.runtime = { baseUrl, model }
  }

  get model() {
    return this.runtime.model || process.env.AI_MODEL || this.aiConfig.model || 'v10'
  }

  isSafe(text) {
    if (!text) return true
    const lower = text.toLowerCase()
    return !this.safety.blockedKeywords.some((kw) => lower.includes(kw.toLowerCase()))
  }

  // Trả chuỗi nội dung hoặc null (lỗi/không an toàn). Hỗ trợ gateway trả JSON thường hoặc SSE.
  async generateWithLLM(prompt, systemInstruction, { temperature } = {}) {
    const apiKey = process.env.AI_API_KEY || this.aiConfig.apiKey || 'dummy'
    const baseUrl = (this.runtime.baseUrl || process.env.AI_BASE_URL || this.aiConfig.baseUrl || 'https://api-ai.vnhat.dev/v1').replace(/\/+$/, '')

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: temperature ?? this.aiConfig.temperature ?? 0.7,
          stream: false,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ]
        })
      })
      if (!res.ok) throw new Error(`LLM API returned ${res.status}`)

      const rawText = await res.text()
      let content = ''
      try {
        content = JSON.parse(rawText).choices?.[0]?.message?.content?.trim() || ''
      } catch {
        for (const line of rawText.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ') || trimmed.includes('[DONE]')) continue
          try {
            const chunk = JSON.parse(trimmed.slice(6))
            content += chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || ''
          } catch {
            // bỏ qua chunk lỗi
          }
        }
        content = content.trim()
      }
      if (content && this.isSafe(content)) return content
    } catch (err) {
      logger.warn(`LLM lỗi (bỏ qua lượt này): ${err.message}`)
    }
    return null
  }

  // Dòng giọng văn + soul chèn vào system prompt. Soul chỉ định tính cách/cách nhìn, KHÔNG phải nguồn sự kiện để bịa.
  voice(persona) {
    return `${persona.tone ? `\nGiọng văn: ${persona.tone}.` : ''}${persona.soul ? `\nLinh hồn của bạn (tính cách, sở thích, cách viết — hãy viết đúng chất này, nhưng không biến nó thành sự kiện/trải nghiệm có thật): ${persona.soul}` : ''}`
  }

  // Bài đăng trong 1 chủ đề được phép: kiến thức chung, không bịa trải nghiệm/số liệu cá nhân, không ảnh ngẫu nhiên
  async generatePost(persona, topic, hint = null) {
    const system = `Bạn viết bài cho mạng xã hội học thuật của Đại học Phenikaa, dưới tài khoản "${persona.displayName}" (khoa ${persona.faculty}, vai trò ${persona.role}).${this.voice(persona)}
Quy tắc bắt buộc:
- Chỉ viết đúng chủ đề: "${topic.label}". Không lạc sang chủ đề khác.
- Chỉ chia sẻ kiến thức, mẹo, hướng dẫn chung, chính xác và hữu ích. KHÔNG bịa trải nghiệm cá nhân, số liệu, sự kiện, tên người, tên môn/lớp cụ thể.
- Không quảng cáo, không chính trị, không bàn tán về cá nhân, không kêu gọi tương tác.
- 80–220 từ, Markdown gọn. Dòng đầu là tiêu đề dạng "# Tiêu đề". Cuối bài có 2–3 hashtag dạng #Tag.`
    const text = await this.generateWithLLM(hint ? `Viết bài về: "${hint}"` : `Viết 1 bài chia sẻ về một khía cạnh thực tế của chủ đề "${topic.label}".`, system)
    if (!text) return null

    const lines = text.split('\n').filter(Boolean)
    const hasTitle = lines[0]?.startsWith('#')
    const title = hasTitle ? lines[0].replace(/^#+\s*/, '').trim() : ''
    const body = (hasTitle ? lines.slice(1) : lines).join('\n').trim()
    const tags = (text.match(/#([a-zA-Z0-9_\p{L}]+)/gu) || []).map((t) => t.slice(1)).slice(0, 5)
    const content = body.replace(/#([a-zA-Z0-9_\p{L}]+)/gu, '').trim()
    if (!content || !title) return null
    return { title, content, tags, topic: topic.slug }
  }

  // Bình luận bám sát nội dung bài; trả null nếu không có gì hữu ích để thêm
  async generateComment(post, persona, topicLabels = []) {
    const system = `Bạn là "${persona.displayName}" (khoa ${persona.faculty}, ${persona.role}) bình luận trên mạng xã hội trường Đại học Phenikaa.${this.voice(persona)}
Quy tắc bắt buộc:
- Bạn CHỈ được bình luận về các chủ đề: ${topicLabels.join('; ') || 'không có'}. Nếu bài không thuộc các chủ đề này (chuyện cá nhân, đời thường, quảng cáo, tuyển dụng, rao vặt…), trả về đúng một từ: ${SKIP}
- Chỉ bình luận khi bạn thật sự có điều cụ thể và hữu ích để thêm (bổ sung, hỏi làm rõ, nêu lưu ý) dựa trên NỘI DUNG bài. Nếu không, trả về đúng một từ: ${SKIP}
- 1–2 câu, bám chi tiết trong bài. Không khen chung chung ("bài hay quá", "cảm ơn chia sẻ"), không hứa hẹn, không bịa số liệu/trải nghiệm, không nói về người khác.
- Không emoji dư thừa, không hashtag, không @mention.`
    const prompt = `Bài viết:\n${post.title ? post.title + '\n' : ''}${String(post.content || '').slice(0, 1200)}`
    return this.cleanShort(await this.generateWithLLM(prompt, system, { temperature: 0.5 }))
  }

  // Trả lời một bình luận (của bot khác, hoặc của người thật dưới bài của chính bot)
  async generateReply(post, persona, targetComment, topicLabels = []) {
    const system = `Bạn là "${persona.displayName}" (khoa ${persona.faculty}) trả lời một bình luận dưới bài viết trên mạng xã hội trường.${this.voice(persona)}
Quy tắc: chỉ nói về các chủ đề: ${topicLabels.join('; ') || 'không có'}; ngoài chủ đề thì trả về ${SKIP}. Chỉ trả lời nếu có điều cụ thể, hữu ích bám sát bài và bình luận; nếu không, trả về đúng một từ: ${SKIP}. 1–2 câu, không bịa, không khen chung chung, không @mention.`
    const prompt = `Bài viết: ${String(post.content || '').slice(0, 600)}\n\nBình luận cần trả lời: ${String(targetComment.content || '').slice(0, 400)}`
    return this.cleanShort(await this.generateWithLLM(prompt, system, { temperature: 0.5 }))
  }

  // Viết lại nội dung do admin đưa cho tự nhiên, giữ nguyên sự thật; trả null nếu AI lỗi
  async enhance(text, persona, kind) {
    const what = kind === 'post' ? 'bài đăng' : 'bình luận'
    const system = `Bạn biên tập ${what} cho mạng xã hội của Đại học Phenikaa, đăng dưới tài khoản "${persona.displayName}".${this.voice(persona)}
Quy tắc bắt buộc: giữ NGUYÊN mọi sự thật, số liệu, ngày giờ, tên riêng; KHÔNG thêm thông tin mới; không link, SĐT, email; giọng tự nhiên, gọn, tiếng Việt; ${kind === 'post' ? 'giữ Markdown, có thể xuống dòng/gạch đầu dòng' : '1–3 câu'}. Chỉ trả về nội dung đã viết lại, không giải thích.`
    const out = await this.generateWithLLM(String(text).slice(0, 4000), system, { temperature: 0.4 })
    if (!out) return null
    const clean = sanitizeContent(out.replace(/^["“]|["”]$/g, ''))
    return clean.length >= 10 ? clean : null
  }

  cleanShort(text) {
    if (!text) return null
    const t = text.trim().replace(/^["“]|["”]$/g, '')
    if (!t || t.toUpperCase().startsWith(SKIP) || t.length > 400) return null
    return t
  }
}
