import { createHash } from 'crypto'
import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import type { CommentItem, PostSummary } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { COMMENT_PROMPT, SUMMARY_PROMPT, SYSTEM_PROMPT } from '../ai/ai.prompts'
import { blockExistsSql } from '../blocks/blocks.sql'
import { N7AI_MENTION } from '../ai/ai.constants'
import { AgentSources } from '../ai/agent-sources'
import { LlmService, type LlmMessage } from '../ai/llm.service'
import { McpAgentService } from '../ai/mcp-agent.service'
import { PucToolsService } from '../chat/n7ai/agent/puc-tools.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { CommentsService } from './comments.service'
import { PostContextService, postBlock } from './post-context.service'
import { PostThreadToolsService } from './post-thread-tools.service'

const SUMMARY_MAX_TOKENS = 2048
const SUMMARY_MIN_CHARS = 300 // Bài ngắn hơn không cần tóm tắt (web chỉ hiện nút khi bài bị thu gọn)
const SUMMARY_INPUT_CHARS = 12000

// N7AI trên bài viết (Domain 13): trả lời @n7ai trong bình luận (agent đọc bài + bình luận, tự tra tài liệu liên quan), tóm tắt bài dài
@Injectable()
export class PostAiService {
  private readonly logger = new Logger(PostAiService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService,
    private readonly agent: McpAgentService,
    private readonly context: PostContextService,
    private readonly threadTools: PostThreadToolsService,
    private readonly pucTools: PucToolsService,
    private readonly comments: CommentsService,
    private readonly realtime: RealtimeGateway
  ) {}

  // Gọi sau khi bình luận đã lưu; chạy nền, không ném lỗi ra ngoài
  async onComment(comment: CommentItem, requesterId: string): Promise<void> {
    if (!N7AI_MENTION.test(comment.content)) return
    try {
      await this.replyToComment(comment, requesterId)
    } catch (err: any) {
      this.logger.error(`N7AI trả lời bình luận ${comment.id} lỗi: ${err?.message}`)
    }
  }

  private async replyToComment(comment: CommentItem, requesterId: string) {
    const started = Date.now()
    const botId = await this.llm.getBotId()
    const reply = (content: string) => this.postReply(botId, comment, content, requesterId)

    if (!this.llm.client) return void (await reply('N7AI chưa sẵn sàng, bạn thử lại sau nhé.'))
    if (!(await this.llm.hasQuota(requesterId))) {
      await this.llm.logRejected(requesterId, 'comment')
      return void (await reply('Bạn đã dùng hết lượt hỏi N7AI hôm nay. Hẹn bạn ngày mai nhé!'))
    }

    const runId = await this.llm.startRun({ requesterId, trigger: 'comment', task: 'comment', source: { type: 'comment', id: comment.id } })
    try {
      const ctx = await this.context.load(comment)
      if (!ctx) return void (await this.llm.failRun(runId, 'post unavailable', started))
      const messages: LlmMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT + COMMENT_PROMPT },
        { role: 'user', content: `${postBlock(ctx)}${ctx.asker}: ${ctx.question || '(Hãy giải thích bài viết này)'}` }
      ]
      // Bình luận công khai ⇒ chỉ tool công khai (tìm bài / tài liệu) + đọc bình luận của chính bài; không connector riêng của người hỏi
      // Public reply: library search + this post's comments only, no private connectors
      const local = [this.threadTools.open(comment.postId, requesterId), this.pucTools.open(requesterId, ['library'], new AgentSources([]), true)]
      let text = ''
      const { finishReason, usage } = await this.agent.stream(messages, requesterId, [], (delta) => (text += delta), undefined, local)
      let answer = text.trim() || 'Xin lỗi, mình không thể trả lời câu hỏi này.'
      if (finishReason === 'length') answer += '\n\n_(Câu trả lời bị cắt do quá dài — hãy hỏi cụ thể hơn.)_'
      const saved = await reply(answer)
      await this.llm.finishRun(runId, { usage, startedAt: started, reply: { type: 'comment', id: saved.id } })
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      await reply(this.llm.isBusyError(err) ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé.' : 'N7AI gặp lỗi khi trả lời. Bạn thử lại sau nhé.')
      throw err
    }
  }

  // Tóm tắt bài: dùng lại bản đã lưu nếu nội dung chưa đổi (không tốn lượt)
  async summarize(postId: string, requesterId: string): Promise<PostSummary> {
    const res = await this.db.query(
      `SELECT p.title, p.content, s.content_hash, s.summary
       FROM posts p LEFT JOIN post_summaries s ON s.post_id = p.id
       WHERE p.id = $1 AND p.hidden_at IS NULL AND (p.archived_at IS NULL OR p.author_id = $2) AND (p.visibility = 'public' OR p.author_id = $2)
         AND NOT ${blockExistsSql('$2::uuid', 'p.author_id')}`,
      [postId, requesterId]
    )
    const post = res.rows[0]
    if (!post) throw new NotFoundException('Không tìm thấy bài viết')
    const text = [post.title, post.content].filter(Boolean).join('\n\n')
    if (text.length < SUMMARY_MIN_CHARS) throw new BadRequestException('Bài viết ngắn, không cần tóm tắt')

    const hash = createHash('sha256').update(text).digest('hex')
    if (post.content_hash === hash) return { summary: post.summary, cached: true }

    if (!this.llm.client) throw new ServiceUnavailableException('N7AI chưa sẵn sàng, bạn thử lại sau nhé')
    if (!(await this.llm.hasQuota(requesterId))) {
      await this.llm.logRejected(requesterId, 'summary')
      throw new HttpException('Bạn đã dùng hết lượt N7AI hôm nay', HttpStatus.TOO_MANY_REQUESTS)
    }

    const started = Date.now()
    const runId = await this.llm.startRun({ requesterId, trigger: 'summary', task: 'summary', source: { type: 'post', id: postId } })
    try {
      const block = postBlock({ title: post.title || '', content: (post.content || '').slice(0, SUMMARY_INPUT_CHARS), author: '', thread: [] })
      const { text: summary, usage } = await this.llm.complete(
        [
          { role: 'system', content: SYSTEM_PROMPT + SUMMARY_PROMPT },
          { role: 'user', content: `${block}Tóm tắt bài viết trên.` }
        ],
        SUMMARY_MAX_TOKENS
      )
      if (!summary) throw new Error('empty summary')
      // Upsert: 2 người bấm cùng lúc ⇒ bản sau ghi đè, cùng nội dung
      await this.db.query(
        `INSERT INTO post_summaries (post_id, content_hash, summary, model) VALUES ($1, $2, $3, $4)
         ON CONFLICT (post_id) DO UPDATE SET content_hash = EXCLUDED.content_hash, summary = EXCLUDED.summary,
                                             model = EXCLUDED.model, created_at = NOW()`,
        [postId, hash, summary, this.llm.model]
      )
      await this.llm.finishRun(runId, { usage, startedAt: started })
      return { summary, cached: false }
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      throw new ServiceUnavailableException(this.llm.isBusyError(err) ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé' : 'N7AI chưa tóm tắt được bài này')
    }
  }

  // Bình luận của @n7ai (qua CommentsService ⇒ đếm, thông báo "đã trả lời bình luận của bạn" dùng chung)
  private async postReply(botId: string, comment: CommentItem, content: string, requesterId: string) {
    const saved = await this.comments.create(botId, { postId: comment.postId, parentId: comment.id, content })
    this.realtime.emitToUser(requesterId, 'comments.changed', { postId: comment.postId })
    return saved
  }
}
