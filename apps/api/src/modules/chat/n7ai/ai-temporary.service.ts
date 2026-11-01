import { Injectable, Logger } from '@nestjs/common'
import type { AiConnectorId, AiStep, AiTemporaryEvent, AiTemporaryInput, ChatCitation } from '@pu/schemas'
import { AgentSources } from '../../ai/agent-sources'
import { SYSTEM_PROMPT } from '../../ai/ai.prompts'
import { DEFAULT_AI_MODEL } from '../../ai/ai-models'
import { LlmService, RESEARCH_COST, RESEARCH_TASK, type LlmMessage } from '../../ai/llm.service'
import { McpAgentService, McpModelError } from '../../ai/mcp-agent.service'
import { N7AgentService } from '../../ai/engine/n7-agent.service'
import { RetrievalToolsService } from '../../ai/retrieval-tools.service'
import { AiProgress } from './agent/ai-progress'
import { PucToolsService } from './agent/puc-tools.service'
import { AiSettingsService } from './ai-settings.service'
import { citationsOf } from './n7ai.service'
import { FOLLOWUP_PROMPT, FollowUpSplitter, SOURCES_PROMPT } from './n7ai.followups'
import { MODE_PROMPTS, RESEARCH_PROMPT } from './n7ai.prompts'

const TEMPORARY_PROMPT = `\n\nĐây là CHAT TẠM: cuộc trò chuyện không được lưu và bạn không có bộ nhớ về người dùng. Không dùng dòng "[nhớ]" và không tạo nút hành động.`

// Chat tạm: stateless — không ghi conversations / messages / bộ nhớ / học liệu; lịch sử do client gửi lại mỗi lượt
// Chỉ ghi 1 dòng ai_runs (không nội dung) để tính quota; chỉ tool đọc (tìm Thư viện PU, web, connector đã bật)
@Injectable()
export class AiTemporaryService {
  private readonly logger = new Logger(AiTemporaryService.name)

  constructor(
    private readonly llm: LlmService,
    private readonly agent: McpAgentService,
    private readonly n7Agent: N7AgentService,
    private readonly settings: AiSettingsService,
    private readonly pucTools: PucToolsService,
    private readonly retrievalTools: RetrievalToolsService
  ) {}

  async stream(userId: string, input: AiTemporaryInput, send: (e: AiTemporaryEvent) => void): Promise<void> {
    const started = Date.now()
    const research = !!input.research
    const mode = input.aiMode ?? 'ask'
    if (!this.llm.client) return send({ type: 'error', message: 'Máy chủ bận' })

    const settings = await this.settings.get(userId)
    const model = settings.aiModel ?? DEFAULT_AI_MODEL
    const cost = Math.max(research ? RESEARCH_COST : 1, await this.settings.modelCost(model))
    const { used, limit } = await this.llm.quota(userId)
    if (used + cost > limit) {
      await this.llm.logRejected(userId, 'dm')
      return send({
        type: 'error',
        message: used < limit ? `Câu hỏi này cần ${cost} lượt, bạn chỉ còn ${limit - used} lượt hôm nay.` : `Bạn đã dùng hết ${limit} lượt hỏi N7AI hôm nay.`
      })
    }

    const runId = await this.llm.startRun({ requesterId: userId, trigger: 'dm', task: research ? RESEARCH_TASK : mode === 'ask' ? 'chat' : mode, model })
    try {
      const connectors: AiConnectorId[] = input.connectors ?? settings.defaultConnectors
      const system =
        SYSTEM_PROMPT + TEMPORARY_PROMPT + MODE_PROMPTS[mode] + (research ? RESEARCH_PROMPT : '') + FOLLOWUP_PROMPT + SOURCES_PROMPT
      const messages: LlmMessage[] = [{ role: 'system', content: system }, ...input.messages.map((m) => ({ role: m.role, content: m.content }))]

      const progress = new AiProgress((steps: AiStep[]) => send({ type: 'progress', steps }))
      const catalog = new AgentSources([])
      const local = [this.pucTools.open(userId, connectors, catalog, false), this.retrievalTools.open(userId, connectors, catalog, research)]
      const splitter = new FollowUpSplitter()
      const emit = (text: string) => text && send({ type: 'delta', text })

      const timeoutSignal = AbortSignal.timeout(research ? 120_000 : 90_000)

      const result = await this.n7Agent.run(
        {
          messages,
          userId,
          sessionId: `temp_${userId}_${Date.now()}`,
          connectors,
          localTools: local,
          model,
          research,
          signal: timeoutSignal
        },
        async (event) => {
          if (event.type === 'thinking') {
            send({ type: 'thinking', text: event.content })
          } else if (event.type === 'content') {
            const pushed = splitter.push(event.content)
            emit(pushed)
          } else if (event.type === 'progress') {
            // Cập nhật trạng thái tiến trình
          } else if (event.type === 'ask_user') {
            send({ type: 'ask_user', questions: (event.metadata as any)?.questions || [] })
          }
        }
      )

      const { rest, text: answer, followUps, cited } = splitter.finish()
      emit(rest)
      let text = answer.trim()
      if (!text) {
        text = 'Xin lỗi, mình không thể trả lời câu hỏi này.'
      }

      const citations: ChatCitation[] = citationsOf(catalog.sources, cited)
      send({
        type: 'done',
        text,
        reasoning: result.reasoning || undefined,
        followUps,
        citations,
        steps: progress.steps,
        durationMs: Date.now() - started,
        askUser: result.pausePayload ? { questions: (result.pausePayload as any).questions } : null
      })
      await this.llm.finishRun(runId, { usage: result.usage, startedAt: started })
    } catch (err) {
      this.logger.warn(`Chat tạm lỗi: ${(err as Error)?.message}`)
      await this.llm.failRun(runId, err, started)
      send({
        type: 'error',
        message:
          err instanceof McpModelError
            ? err.message
            : this.llm.isBusyError(err)
              ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé.'
              : 'N7AI gặp lỗi khi trả lời. Bạn thử lại sau nhé.'
      })
    }
  }
}
