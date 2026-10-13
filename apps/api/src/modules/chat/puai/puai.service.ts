import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import type { AiMode, ChatAttachment, ChatCitation, ChatMessage } from '@pu/schemas'
import { SYSTEM_PROMPT } from '../../ai/ai.prompts'
import { stripPuaiMention } from '../../ai/ai.constants'
import { AiRetrieval, contextBlock } from '../../ai/ai.retrieval'
import { LlmService, MAX_OUTPUT_TOKENS, type LlmMessage as Msg, type LlmUsage } from '../../ai/llm.service'
import { ChatCoreService } from '../chat-core.service'
import { ChatPushService } from '../notify/chat-push.service'
import { attachmentParts, isReadableDoc } from './puai.attachments'
import { GROUP_PROMPT, MODE_PROMPTS } from './puai.prompts'

const AI_HISTORY_LIMIT = 20
const GROUP_HISTORY_LIMIT = 12

type Trigger = { id: string; type: string; content: string; attachments: ChatAttachment[] | null; aiMode: AiMode; senderName: string }

// PU AI: hội thoại riêng (type='ai') hoặc được @puai trong nhóm
// Truy xuất nguồn (full-text) → gọi LLM OpenAI-compatible (streaming) → đẩy delta qua socket
@Injectable()
export class PuaiService {
  private readonly logger = new Logger(PuaiService.name)

  constructor(
    private readonly core: ChatCoreService,
    private readonly llm: LlmService,
    private readonly retrieval: AiRetrieval,
    private readonly chatPush: ChatPushService
  ) {}

  private get db() {
    return this.core.db
  }

  // "Chủ đề mới": PU AI quên các tin phía trên mốc này
  async resetContext(userId: string, conversationId: string): Promise<ChatMessage> {
    const message = await this.db.transaction(async (client) => {
      const m = await this.core.membership(client, userId, conversationId)
      if (m?.type !== 'ai') throw new BadRequestException('Chỉ dùng trong hội thoại PU AI')
      return this.core.insertSystem(client, conversationId, userId, 'Chủ đề mới — PU AI không còn nhớ các tin phía trên', { event: 'ai.reset' })
    })
    await this.core.broadcast(conversationId, 'message.new', message)
    return message
  }

  // Trả lời tin vừa gửi (chạy nền, không ném lỗi ra ngoài)
  async reply(conversationId: string, requesterId: string, triggerId: string): Promise<void> {
    try {
      await this.runReply(conversationId, requesterId, triggerId)
    } catch (err: any) {
      this.logger.error(`PU AI lỗi (conv ${conversationId}): ${err?.message}`)
    }
  }

  private async runReply(conversationId: string, requesterId: string, triggerId: string) {
    const botId = await this.llm.getBotId()
    const started = Date.now()
    const trigger = await this.loadTrigger(triggerId)
    if (!trigger) return
    const inGroup = trigger.type === 'group'
    const replyTo = inGroup ? trigger.id : null

    const { used, limit } = await this.llm.quota(requesterId)
    if (used >= limit) {
      await this.llm.logRejected(requesterId, inGroup ? 'mention' : 'dm')
      await this.postFinal(conversationId, botId, `Bạn đã dùng hết ${limit} lượt hỏi PU AI hôm nay. Hẹn bạn ngày mai nhé!`, replyTo)
      return
    }

    // Tin trả lời tạm (status=streaming) để client hiện ngay và nối delta vào
    const placeholder = await this.db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, kind, content, status, reply_to_id, meta)
         VALUES ($1, $2, 'ai', '', 'streaming', $3, $4) RETURNING id`,
        [conversationId, botId, replyTo, trigger.aiMode !== 'ask' ? JSON.stringify({ aiMode: trigger.aiMode }) : null]
      )
      await this.core.touchConversation(client, conversationId, ins.rows[0].id)
      return this.core.fetchMessage(client, ins.rows[0].id)
    })
    await this.core.broadcast(conversationId, 'message.new', placeholder)

    const runId = await this.llm.startRun({
      requesterId,
      trigger: inGroup ? 'mention' : 'dm',
      task: trigger.aiMode === 'ask' ? 'chat' : trigger.aiMode,
      source: { type: 'message', id: trigger.id },
      reply: { type: 'message', id: placeholder.id }
    })

    const client = this.llm.client
    if (!client) {
      await this.finish(placeholder.id, conversationId, 'Máy chủ bận', null, 'error')
      await this.llm.failRun(runId, 'disabled', started)
      return
    }

    const question = stripPuaiMention(trigger.content)
    const sources = await this.retrieval.retrieve(question, requesterId)
    const messages = await this.buildMessages(conversationId, botId, trigger, question, sources)

    try {
      const stream = await client.chat.completions.create({
        model: this.llm.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
        messages
      })
      // Danh sách thành viên lấy 1 lần (delta đến liên tục)
      const memberIds = await this.core.memberIds(conversationId)
      let text = ''
      let finishReason: string | null = null
      let usage: LlmUsage = { prompt_tokens: 0, completion_tokens: 0 }
      for await (const chunk of stream) {
        const choice = chunk.choices[0]
        const delta = choice?.delta?.content
        if (delta) {
          text += delta
          this.core.emitTo(memberIds, 'message.delta', { conversationId, messageId: placeholder.id, delta })
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason
        if (chunk.usage) usage = chunk.usage
      }

      text = text.trim()
      if (finishReason === 'content_filter' || !text) text = 'Xin lỗi, mình không thể trả lời câu hỏi này.'
      if (finishReason === 'length') text += '\n\n_(Câu trả lời bị cắt do quá dài — hãy hỏi cụ thể hơn.)_'

      const citations: ChatCitation[] = sources.map((s) => ({ type: 'citation', ref: { type: s.type, id: s.id }, title: s.title }))
      await this.finish(placeholder.id, conversationId, text, citations.length ? citations : null, 'done')
      await this.llm.finishRun(runId, { usage, startedAt: started })
    } catch (err) {
      const busy = this.llm.isBusyError(err)
      await this.finish(
        placeholder.id,
        conversationId,
        busy ? 'PU AI đang quá tải, bạn thử lại sau ít phút nhé.' : 'PU AI gặp lỗi khi trả lời. Bạn thử lại sau nhé.',
        null,
        'error'
      )
      await this.llm.failRun(runId, err, started)
      throw err
    }
  }

  private async loadTrigger(messageId: string): Promise<Trigger | null> {
    const res = await this.db.query(
      `SELECT m.id, m.content, m.attachments, m.meta, c.type, u.display_name
       FROM messages m JOIN conversations c ON c.id = m.conversation_id LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [messageId]
    )
    const r = res.rows[0]
    if (!r) return null
    return {
      id: String(r.id),
      type: r.type,
      content: r.content || '',
      attachments: r.attachments,
      aiMode: r.meta?.aiMode || 'ask',
      senderName: r.display_name || 'Thành viên'
    }
  }

  // System prompt (+ chế độ học, + nhóm) → lịch sử → lượt hỏi hiện tại (nguồn + tệp đính kèm)
  private async buildMessages(conversationId: string, botId: string, trigger: Trigger, question: string, sources: any[]): Promise<Msg[]> {
    const inGroup = trigger.type === 'group'
    const system = SYSTEM_PROMPT + (inGroup ? GROUP_PROMPT : '') + MODE_PROMPTS[trigger.aiMode]
    const history = await this.loadHistory(conversationId, botId, trigger.id, inGroup)

    const { parts, notes } = await attachmentParts(trigger.attachments)
    // Không gửi kèm tệp ⇒ dùng lại tài liệu gần nhất trong chủ đề (hỏi tiếp về cùng PDF/DOCX)
    let docNote = ''
    if (!trigger.attachments?.length) {
      const recent = await this.recentDocuments(conversationId, trigger.id)
      if (recent.length) {
        const prev = await attachmentParts(recent, { images: false })
        parts.push(...prev.parts)
        if (prev.parts.length) docNote = `\n\n(Tài liệu đang thảo luận, gửi ở tin trước: ${recent.map((a) => a.name).join(', ')})`
      }
    }
    const label = inGroup ? `${trigger.senderName}: ` : ''
    const fileNote = notes.length ? `\n\n(Người dùng có gửi kèm tệp PU AI chưa đọc được: ${notes.join(', ')})` : ''
    const text = `${contextBlock(sources)}${label}${question || '(Xem tệp đính kèm)'}${fileNote}${docNote}`
    const current: Msg = { role: 'user', content: parts.length ? [{ type: 'text', text }, ...parts] : text }

    return [{ role: 'system', content: system }, ...history, current]
  }

  // Tài liệu đọc được ở tin gần nhất (≤ 10 tin trước, sau mốc "Chủ đề mới") / Latest readable docs in topic
  private async recentDocuments(conversationId: string, beforeId: string): Promise<ChatAttachment[]> {
    const res = await this.db.query(
      `SELECT attachments FROM (
         SELECT id, attachments FROM messages
         WHERE conversation_id = $1 AND id < $2 AND deleted_at IS NULL AND kind <> 'system'
           AND id > COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = $1 AND kind = 'system' AND meta->>'event' = 'ai.reset'), 0)
         ORDER BY id DESC LIMIT 10
       ) t WHERE attachments IS NOT NULL ORDER BY id DESC`,
      [conversationId, beforeId]
    )
    for (const row of res.rows) {
      const docs = (row.attachments as ChatAttachment[]).filter(isReadableDoc)
      if (docs.length) return docs
    }
    return []
  }

  // Lịch sử trước tin hiện tại ⇒ lượt user/assistant xen kẽ (gộp lượt liên tiếp cùng vai)
  // AI riêng: từ mốc "Chủ đề mới" gần nhất; nhóm: vài tin gần nhất kèm tên người gửi
  private async loadHistory(conversationId: string, botId: string, beforeId: string, inGroup: boolean): Promise<Msg[]> {
    const res = await this.db.query(
      `SELECT m.sender_id, m.content, m.attachments, u.display_name FROM messages m LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.id < $2 AND m.deleted_at IS NULL AND m.status = 'done' AND m.kind <> 'system'
         AND m.id > COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = $1 AND kind = 'system' AND meta->>'event' = 'ai.reset'), 0)
       ORDER BY m.id DESC LIMIT $3`,
      [conversationId, beforeId, inGroup ? GROUP_HISTORY_LIMIT : AI_HISTORY_LIMIT]
    )
    const turns: { role: 'user' | 'assistant'; content: string }[] = []
    for (const row of res.rows.reverse()) {
      const role = row.sender_id === botId ? 'assistant' : 'user'
      const files = row.attachments?.length ? ` [đã gửi ${row.attachments.length} tệp]` : ''
      const body = (inGroup && role === 'user' ? `${row.display_name}: ` : '') + (row.content || '') + files
      if (!body.trim()) continue
      const last = turns[turns.length - 1]
      if (last && last.role === role) last.content = `${last.content}\n\n${body}`
      else turns.push({ role, content: body })
    }
    while (turns.length && turns[0].role !== 'user') turns.shift()
    // Lượt hiện tại là user ⇒ lịch sử phải kết thúc bằng assistant
    while (turns.length && turns[turns.length - 1].role !== 'assistant') turns.pop()
    return turns
  }

  private async postFinal(conversationId: string, botId: string, text: string, replyTo: string | null) {
    const message = await this.db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, kind, content, reply_to_id) VALUES ($1, $2, 'ai', $3, $4) RETURNING id`,
        [conversationId, botId, text, replyTo]
      )
      await this.core.touchConversation(client, conversationId, ins.rows[0].id)
      return this.core.fetchMessage(client, ins.rows[0].id)
    })
    await this.core.broadcast(conversationId, 'message.new', message)
  }

  private async finish(messageId: string, conversationId: string, text: string, blocks: ChatCitation[] | null, status: 'done' | 'error') {
    await this.db.query(`UPDATE messages SET content = $2, blocks = $3, status = $4 WHERE id = $1`, [
      messageId,
      text,
      blocks ? JSON.stringify(blocks) : null,
      status
    ])
    const message = await this.core.fetchMessage(this.db, messageId)
    await this.core.broadcast(conversationId, 'message.updated', message)
    // Trả lời xong ⇒ push cho người đang chờ (đã rời app)
    void this.chatPush.onNewMessage(conversationId, message.sender?.id ?? null)
  }
}
