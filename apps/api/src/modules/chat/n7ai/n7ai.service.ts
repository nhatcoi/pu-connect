import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import type { AiConnectorId, AiMode, AiSettings, ChatAttachment, ChatCitation, ChatMessage, ChatMessageMeta, ChatRef } from '@pu/schemas'
import { SYSTEM_PROMPT } from '../../ai/ai.prompts'
import { stripN7AiMention } from '../../ai/ai.constants'
import { AiRetrieval, contextBlock, type Retrieved, type Source } from '../../ai/ai.retrieval'
import { McpAgentService, McpModelError } from '../../ai/mcp-agent.service'
import { LlmService, RESEARCH_COST, RESEARCH_TASK, type LlmMessage as Msg } from '../../ai/llm.service'
import { StudyToolsService } from '../../study-tools/study-tools.service'
import { ChatCoreService } from '../chat-core.service'
import { ChatPushService } from '../notify/chat-push.service'
import { ChatRefsService } from '../refs/chat-refs.service'
import { AI_HISTORY_FLOOR, AiSummaryService } from './ai-summary.service'
import { AiMemoriesService } from './ai-memories.service'
import { AiSettingsService } from './ai-settings.service'
import { AiSkillsService } from './ai-skills.service'
import { attachmentParts, isReadableDoc } from './n7ai.attachments'
import { FOLLOWUP_PROMPT, FollowUpSplitter, MEMORY_PROMPT, SOURCES_PROMPT } from './n7ai.followups'
import { GROUP_PROMPT, MODE_PROMPTS, RESEARCH_PROMPT, profilePrompt, skillPrompt, summaryPrompt } from './n7ai.prompts'

const AI_HISTORY_LIMIT = 20
const GROUP_HISTORY_LIMIT = 12

type Trigger = {
  id: string
  senderId: string // người hỏi (chủ skill)
  type: string // loại hội thoại: ai | group
  content: string
  attachments: ChatAttachment[] | null
  aiMode: AiMode
  senderName: string
  refs: ChatRef[]
  skillId: string | null
  research: boolean
  connectors: AiConnectorId[] | undefined
}

export type ReplyOutcome = 'done' | 'skipped' | 'error' // skipped = hết lượt hôm nay

// Nguồn hiện được ở "Nguồn tham khảo" (có trang / liên kết); nhóm học, khóa học, thread thì không
type CitableType = ChatCitation['ref']['type']
const CITABLE = new Set<Source['type']>(['post', 'document', 'drive', 'calendar', 'web'])
const isCitable = (s: Source): s is Source & { type: CitableType } => CITABLE.has(s.type)

// Chỉ nguồn N7AI ghi "[nguồn] n" — không phải mọi kết quả tìm được
function citationsOf(sources: Source[], cited: number[]): ChatCitation[] {
  return cited
    .map((n) => sources[n - 1])
    .filter((s): s is Source & { type: CitableType } => !!s && isCitable(s))
    .map((s) => ({ type: 'citation', ref: { type: s.type, id: s.id }, title: s.title }))
}

// N7AI: hội thoại riêng (type='ai') hoặc được @n7ai trong nhóm
// Ngữ cảnh ghim + nguồn theo connector → gọi LLM OpenAI-compatible (streaming) → đẩy delta qua socket
@Injectable()
export class N7AiService {
  private readonly logger = new Logger(N7AiService.name)

  constructor(
    private readonly core: ChatCoreService,
    private readonly llm: LlmService,
    private readonly agent: McpAgentService,
    private readonly retrieval: AiRetrieval,
    private readonly chatPush: ChatPushService,
    private readonly refs: ChatRefsService,
    private readonly skills: AiSkillsService,
    private readonly summaries: AiSummaryService,
    private readonly settings: AiSettingsService,
    private readonly memories: AiMemoriesService,
    private readonly studyTools: StudyToolsService
  ) {}

  private get db() {
    return this.core.db
  }

  // "Chủ đề mới": N7AI quên các tin phía trên mốc này
  async resetContext(userId: string, conversationId: string): Promise<ChatMessage> {
    const message = await this.db.transaction(async (client) => {
      const m = await this.core.membership(client, userId, conversationId)
      if (m?.type !== 'ai') throw new BadRequestException('Chỉ dùng trong hội thoại N7AI')
      return this.core.insertSystem(client, conversationId, userId, 'Chủ đề mới — N7AI không còn nhớ các tin phía trên', { event: 'ai.reset' })
    })
    await this.core.broadcast(conversationId, 'message.new', message)
    return message
  }

  // Trả lời tin vừa gửi (không ném lỗi ra ngoài); kết quả dùng cho tác vụ tự động (đếm lỗi, bỏ qua khi hết lượt)
  async reply(conversationId: string, requesterId: string, triggerId: string): Promise<ReplyOutcome> {
    try {
      return await this.runReply(conversationId, requesterId, triggerId)
    } catch (err: any) {
      this.logger.error(`N7AI lỗi (conv ${conversationId}): ${err?.message}`)
      return 'error'
    }
  }

  private async runReply(conversationId: string, requesterId: string, triggerId: string): Promise<ReplyOutcome> {
    const botId = await this.llm.getBotId()
    const started = Date.now()
    const trigger = await this.loadTrigger(triggerId)
    if (!trigger || trigger.senderId !== requesterId) return 'error'
    const inGroup = trigger.type === 'group'
    // Nhóm chat: không dùng cài đặt / dữ liệu riêng của người hỏi
    const settings = inGroup ? null : await this.settings.get(trigger.senderId)
    const replyTo = inGroup ? trigger.id : null

    // Research tốn 2 lượt ⇒ còn 1 lượt thì báo rõ thay vì "hết lượt"
    const cost = trigger.research ? RESEARCH_COST : 1
    const { used, limit } = await this.llm.quota(requesterId)
    if (used + cost > limit) {
      await this.llm.logRejected(requesterId, inGroup ? 'mention' : 'dm')
      const text =
        used < limit
          ? `Research cần ${cost} lượt, bạn chỉ còn ${limit - used} lượt hôm nay. Tắt Research để hỏi thường nhé!`
          : `Bạn đã dùng hết ${limit} lượt hỏi N7AI hôm nay. Hẹn bạn ngày mai nhé!`
      await this.postFinal(conversationId, botId, text, replyTo)
      return 'skipped'
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
      task: trigger.research ? RESEARCH_TASK : trigger.aiMode === 'ask' ? 'chat' : trigger.aiMode,
      source: { type: 'message', id: trigger.id },
      reply: { type: 'message', id: placeholder.id }
    })

    const client = this.llm.client
    if (!client) {
      await this.finish(placeholder.id, conversationId, 'Máy chủ bận', null, 'error')
      await this.llm.failRun(runId, 'disabled', started)
      return 'error'
    }

    const question = stripN7AiMention(trigger.content)
    const retrieved = await this.gatherSources(trigger, question, requesterId, settings)
    const messages = await this.buildMessages(conversationId, botId, trigger, question, retrieved, settings)

    try {
      // Danh sách thành viên lấy 1 lần (delta đến liên tục)
      const memberIds = await this.core.memberIds(conversationId)
      const emit = (delta: string) => this.core.emitTo(memberIds, 'message.delta', { conversationId, messageId: placeholder.id, delta })
      // Phần sau dấu mốc = câu hỏi gợi ý tiếp theo ⇒ không đẩy ra màn hình
      const splitter = new FollowUpSplitter()
      const { finishReason, usage } = await this.agent.stream(
        messages,
        requesterId,
        inGroup ? [] : (trigger.connectors ?? settings?.defaultConnectors ?? ['library']),
        (delta) => {
          const shown = splitter.push(delta)
          if (shown) emit(shown)
        }
      )

      const { rest, text: answer, followUps, memories, cited } = splitter.finish()
      if (rest) emit(rest)
      let text = answer.trim()
      if (finishReason === 'content_filter' || !text) text = 'Xin lỗi, mình không thể trả lời câu hỏi này.'
      if (finishReason === 'length') text += '\n\n_(Câu trả lời bị cắt do quá dài — hãy hỏi cụ thể hơn.)_'

      // Bộ nhớ dài hạn: lưu dữ kiện N7AI vừa rút ra (chỉ khi người dùng bật)
      const remembered =
        settings?.memoryEnabled && memories.length ? await this.memories.saveFromReply(trigger.senderId, placeholder.id, memories).catch(() => []) : []
      const citations = citationsOf(retrieved.sources, cited)
      // Bộ flashcard / quiz trong câu trả lời ⇒ tự lưu vào Công cụ của người hỏi (chỉ thread riêng)
      const studySet = inGroup ? null : await this.studyTools.saveFromReply(trigger.senderId, placeholder.id, text)
      await this.finish(placeholder.id, conversationId, text, citations.length ? citations : null, 'done', {
        ...(finishReason === 'length' || finishReason === 'content_filter' || !followUps.length ? {} : { followUps }),
        ...(remembered.length ? { memoryUpdated: remembered } : {}),
        ...(studySet ? { studySet } : {})
      })
      await this.llm.finishRun(runId, { usage, startedAt: started })
      if (!inGroup) this.summaries.maybeSummarize(conversationId, botId)
      return 'done'
    } catch (err) {
      const busy = this.llm.isBusyError(err)
      await this.finish(
        placeholder.id,
        conversationId,
        err instanceof McpModelError
          ? err.message
          : busy
            ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé.'
            : 'N7AI gặp lỗi khi trả lời. Bạn thử lại sau nhé.',
        null,
        'error'
      )
      await this.llm.failRun(runId, err, started)
      throw err
    }
  }

  private async loadTrigger(messageId: string): Promise<Trigger | null> {
    const res = await this.db.query(
      `SELECT m.id, m.sender_id, m.content, m.attachments, m.meta, c.type, u.display_name
       FROM messages m JOIN conversations c ON c.id = m.conversation_id LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [messageId]
    )
    const r = res.rows[0]
    if (!r) return null
    const meta: ChatMessageMeta = r.meta || {}
    return {
      id: String(r.id),
      senderId: r.sender_id,
      type: r.type,
      content: r.content || '',
      attachments: r.attachments,
      aiMode: meta.aiMode || 'ask',
      senderName: r.display_name || 'Thành viên',
      refs: meta.refs ?? [],
      skillId: meta.skill?.id ?? null,
      research: !!meta.research,
      connectors: meta.connectors
    }
  }

  // Ngữ cảnh ghim (refs) trước, rồi nguồn truy xuất theo connector (bỏ trùng)
  // Nhóm chat: chỉ Thư viện PU — không đưa tài liệu riêng của người hỏi cho cả nhóm
  private async gatherSources(trigger: Trigger, question: string, requesterId: string, settings: AiSettings | null): Promise<Retrieved> {
    const connectors: AiConnectorId[] = settings ? (trigger.connectors ?? settings.defaultConnectors) : ['library']
    const [pinned, found] = await Promise.all([
      this.refs.sources(requesterId, trigger.refs),
      this.retrieval.retrieve(question, requesterId, { connectors, research: trigger.research })
    ])
    const seen = new Set(pinned.map((s) => `${s.type}:${s.id}`))
    return { sources: [...pinned, ...found.sources.filter((s) => !seen.has(`${s.type}:${s.id}`))], failures: found.failures }
  }

  // System prompt (+ nhóm, chế độ học, Research, skill, trí nhớ) → lịch sử → lượt hỏi hiện tại (nguồn + tệp đính kèm)
  private async buildMessages(
    conversationId: string,
    botId: string,
    trigger: Trigger,
    question: string,
    { sources, failures }: Retrieved,
    settings: AiSettings | null
  ): Promise<Msg[]> {
    const inGroup = trigger.type === 'group'
    const memoryOn = !!settings?.memoryEnabled
    const [history, skill, summary, profile] = await Promise.all([
      this.loadHistory(conversationId, botId, trigger.id, inGroup),
      trigger.skillId ? this.skills.instructions(trigger.senderId, trigger.skillId) : null,
      inGroup ? null : this.summaries.summary(conversationId),
      memoryOn ? this.memories.recall(trigger.senderId, question) : []
    ])
    const system =
      SYSTEM_PROMPT +
      (inGroup ? GROUP_PROMPT : '') +
      MODE_PROMPTS[trigger.aiMode] +
      (trigger.research ? RESEARCH_PROMPT : '') +
      (skill ? skillPrompt(skill.name, skill.instructions) : '') +
      (summary ? summaryPrompt(summary) : '') +
      (profile.length ? profilePrompt(profile) : '') +
      (inGroup ? '' : FOLLOWUP_PROMPT + (memoryOn ? MEMORY_PROMPT : '')) +
      (sources.length ? SOURCES_PROMPT : '')

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
    const fileNote = notes.length ? `\n\n(Người dùng có gửi kèm tệp N7AI chưa đọc được: ${notes.join(', ')})` : ''
    const text = `${contextBlock(sources, failures)}${label}${question || '(Xem tệp đính kèm)'}${fileNote}${docNote}`
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
  // AI riêng: sau mốc "Chủ đề mới" / phần đã tóm tắt; nhóm: vài tin gần nhất kèm tên người gửi
  private async loadHistory(conversationId: string, botId: string, beforeId: string, inGroup: boolean): Promise<Msg[]> {
    const res = await this.db.query(
      `SELECT m.sender_id, m.content, m.attachments, u.display_name
       FROM messages m JOIN conversations c ON c.id = m.conversation_id LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.id < $2 AND m.deleted_at IS NULL AND m.status = 'done' AND m.kind <> 'system'
         AND m.id > ${AI_HISTORY_FLOOR}
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

  private async finish(
    messageId: string,
    conversationId: string,
    text: string,
    blocks: ChatCitation[] | null,
    status: 'done' | 'error',
    extraMeta: Pick<ChatMessageMeta, 'followUps' | 'memoryUpdated' | 'studySet'> = {}
  ) {
    // Gợi ý tiếp theo / bộ nhớ vừa cập nhật gộp vào meta (giữ aiMode sẵn có)
    await this.db.query(
      `UPDATE messages SET content = $2, blocks = $3, status = $4,
         meta = CASE WHEN $5::jsonb IS NULL THEN meta ELSE COALESCE(meta, '{}'::jsonb) || $5::jsonb END
       WHERE id = $1`,
      [messageId, text, blocks ? JSON.stringify(blocks) : null, status, Object.keys(extraMeta).length ? JSON.stringify(extraMeta) : null]
    )
    const message = await this.core.fetchMessage(this.db, messageId)
    await this.core.broadcast(conversationId, 'message.updated', message)
    // Trả lời xong ⇒ push cho người đang chờ (đã rời app)
    void this.chatPush.onNewMessage(conversationId, message.sender?.id ?? null)
  }
}
