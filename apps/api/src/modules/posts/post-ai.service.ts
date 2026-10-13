import { Injectable, Logger } from '@nestjs/common'
import type { CommentItem } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { COMMENT_PROMPT, SYSTEM_PROMPT } from '../ai/ai.prompts'
import { PUAI_MENTION, stripPuaiMention } from '../ai/ai.constants'
import { AiRetrieval, contextBlock } from '../ai/ai.retrieval'
import { LlmService, type LlmMessage } from '../ai/llm.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { CommentsService } from './comments.service'

const POST_CHARS = 4000 // Nội dung bài đưa vào ngữ cảnh
const THREAD_LIMIT = 12 // Số bình luận trước đó trong cùng nhánh
const COMMENT_MAX_TOKENS = 4096

type ThreadContext = { title: string; content: string; author: string; thread: { name: string; content: string }[]; question: string; asker: string }

// PU AI dưới bài viết: được @puai trong bình luận ⇒ trả lời thành bình luận con (Domain 13 · P3)
@Injectable()
export class PostAiService {
  private readonly logger = new Logger(PostAiService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService,
    private readonly retrieval: AiRetrieval,
    private readonly comments: CommentsService,
    private readonly realtime: RealtimeGateway
  ) {}

  // Gọi sau khi bình luận đã lưu; chạy nền, không ném lỗi ra ngoài
  async onComment(comment: CommentItem, requesterId: string): Promise<void> {
    if (!PUAI_MENTION.test(comment.content)) return
    try {
      await this.replyToComment(comment, requesterId)
    } catch (err: any) {
      this.logger.error(`PU AI trả lời bình luận ${comment.id} lỗi: ${err?.message}`)
    }
  }

  private async replyToComment(comment: CommentItem, requesterId: string) {
    const started = Date.now()
    const botId = await this.llm.getBotId()
    const reply = (content: string) => this.postReply(botId, comment, content, requesterId)

    if (!this.llm.client) return void (await reply('PU AI chưa sẵn sàng, bạn thử lại sau nhé.'))
    if (!(await this.llm.hasQuota(requesterId))) {
      await this.llm.logRejected(requesterId, 'comment')
      return void (await reply('Bạn đã dùng hết lượt hỏi PU AI hôm nay. Hẹn bạn ngày mai nhé!'))
    }

    const runId = await this.llm.startRun({ requesterId, trigger: 'comment', task: 'comment', source: { type: 'comment', id: comment.id } })
    try {
      const ctx = await this.loadContext(comment)
      if (!ctx) return void (await this.llm.failRun(runId, 'post unavailable', started))
      // Bỏ chính bài đang bàn khỏi nguồn (đã có trong <post>)
      const sources = (await this.retrieval.retrieve(ctx.question || ctx.title, requesterId)).filter((s) => !(s.type === 'post' && s.id === comment.postId))
      const messages: LlmMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT + COMMENT_PROMPT },
        { role: 'user', content: `${postBlock(ctx)}${contextBlock(sources)}${ctx.asker}: ${ctx.question || '(Hãy giải thích bài viết này)'}` }
      ]
      const { text, finishReason, usage } = await this.llm.complete(messages, COMMENT_MAX_TOKENS)
      let answer = text || 'Xin lỗi, mình không thể trả lời câu hỏi này.'
      if (finishReason === 'length') answer += '\n\n_(Câu trả lời bị cắt do quá dài — hãy hỏi cụ thể hơn.)_'
      const saved = await reply(answer)
      await this.llm.finishRun(runId, { usage, startedAt: started, reply: { type: 'comment', id: saved.id } })
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      await reply(this.llm.isBusyError(err) ? 'PU AI đang quá tải, bạn thử lại sau ít phút nhé.' : 'PU AI gặp lỗi khi trả lời. Bạn thử lại sau nhé.')
      throw err
    }
  }

  // Bình luận của @puai (qua CommentsService ⇒ đếm, thông báo "đã trả lời bình luận của bạn" dùng chung)
  private async postReply(botId: string, comment: CommentItem, content: string, requesterId: string) {
    const saved = await this.comments.create(botId, { postId: comment.postId, parentId: comment.id, content })
    this.realtime.emitToUser(requesterId, 'comments.changed', { postId: comment.postId })
    return saved
  }

  // Bài viết + các bình luận trước trong cùng nhánh (gốc + trả lời)
  private async loadContext(comment: CommentItem): Promise<ThreadContext | null> {
    const post = await this.db.query(
      `SELECT p.title, p.content, u.display_name AS author FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.id = $1 AND p.hidden_at IS NULL`,
      [comment.postId]
    )
    if (!post.rows[0]) return null
    const thread = await this.db.query(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id, created_at FROM comments WHERE id = $1
         UNION ALL
         SELECT c.id, c.parent_id, c.created_at FROM comments c JOIN up ON c.id = up.parent_id
       ), root AS (SELECT id FROM up WHERE parent_id IS NULL)
       SELECT u.display_name AS name, c.content FROM comments c JOIN users u ON u.id = c.author_id
       WHERE (c.id = (SELECT id FROM root) OR c.parent_id = (SELECT id FROM root))
         AND c.id <> $1 AND c.created_at <= (SELECT created_at FROM comments WHERE id = $1)
       ORDER BY c.created_at DESC LIMIT $2`,
      [comment.id, THREAD_LIMIT]
    )
    const p = post.rows[0]
    return {
      title: p.title || '',
      content: (p.content || '').slice(0, POST_CHARS),
      author: p.author,
      thread: thread.rows.reverse(),
      question: stripPuaiMention(comment.content),
      asker: comment.author?.displayName || 'Người hỏi'
    }
  }
}

// Bài + bình luận là DỮ LIỆU (không phải chỉ dẫn) — giống khối <context>
function postBlock(ctx: ThreadContext): string {
  const attr = (s: string) => s.replace(/"/g, "'")
  const thread = ctx.thread.length ? `\n<thread>\n${ctx.thread.map((c) => `${c.name}: ${c.content}`).join('\n')}\n</thread>` : ''
  return `<post title="${attr(ctx.title)}" author="${attr(ctx.author)}">\n${ctx.content}\n</post>${thread}\n\n`
}
