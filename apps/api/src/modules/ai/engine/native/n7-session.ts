/**
 * Agent engine — N7AgentSession: thực thi từng thao tác mà bộ lập lịch (core/run-loop) yêu cầu.
 * Bộ lập lịch quyết định NÊN làm gì; phiên này làm việc thật (gọi model, chạy tool, chèn chỉ dẫn).
 */
import type { LoopHost, LoopState, Operation, Operations } from '../core/contracts'
import { runLoop } from '../core/run-loop'
import { Conversation } from '../context/conversation'
import type { LlmService } from '../../llm.service'
import { ToolDispatcher } from '../tools/dispatcher'
import { resolveCopy } from './copy'
import { executeModelRound } from './model-round'
import type { AskUserPause, EngineCopy, Emit, JsonRecord, Message, N7AgentInput, N7AgentResult, Round, Usage } from './types'

/** Model dùng hết ngân sách đầu ra cho suy nghĩ hai lần liên tiếp mà vẫn không có câu trả lời */
export class ReasoningBudgetExhausted extends Error {
  constructor() {
    super('The model exhausted its reasoning output budget twice without an answer')
    this.name = 'ReasoningBudgetExhausted'
  }
}

const isLength = (reason: string) => ['length', 'max_tokens', 'max_output_tokens'].includes(reason)

export class N7AgentSession implements LoopHost {
  private readonly conversation: Conversation
  private readonly dispatcher: ToolDispatcher
  private readonly copy: EngineCopy
  private round: Round | undefined
  private response = ''
  private reasoning = ''
  private completed = false
  private finishReason = 'stop'
  private askUser: AskUserPause | null = null
  private redirect = ''
  private executed: string[] = []
  private rounds = 0
  private settling = false
  private modelWaitMs = 0
  private modelStreamMs = 0
  private readonly usage: Usage = { prompt_tokens: 0, completion_tokens: 0 }
  private state: LoopState = { rounds: 0, exploration_rounds: 0, settlement_rounds: 0, tool_steps: 0, reasoning_budget_recoveries: 0 }

  constructor(
    private readonly llm: LlmService,
    private readonly input: N7AgentInput,
    private readonly emit: Emit,
    private readonly signal: AbortSignal,
    private readonly onCheckpoint?: (messages: Message[]) => Promise<void> | void
  ) {
    this.copy = resolveCopy(input.copy)
    this.conversation = new Conversation(input.seed)
    this.dispatcher = new ToolDispatcher(input.execute, emit, signal, this.copy)
  }

  async run(): Promise<N7AgentResult> {
    await this.checkpoint()
    this.state = await runLoop(this, this.input.config, this.signal)
    await this.checkpoint()
    return {
      state: this.state,
      response: this.response,
      reasoning: this.reasoning,
      completed: this.completed,
      finishReason: this.finishReason,
      usage: this.usage,
      rounds: this.rounds,
      askUser: this.askUser,
      timings: { modelWaitMs: this.modelWaitMs, modelStreamMs: this.modelStreamMs }
    }
  }

  async invoke<K extends Operation>(operation: K, args: Operations[K]['input'], state: Readonly<LoopState>): Promise<Operations[K]['output']> {
    this.state = { ...state }
    return (await this.operate(operation, args as JsonRecord)) as Operations[K]['output']
  }

  // Tin người dùng gửi thêm giữa lúc đang trả lời: chèn vào ngữ cảnh để vòng sau trả lời gộp
  private async takeInputs() {
    const inputs = (await this.input.drainInputs?.()) ?? []
    if (!inputs.length) return
    this.conversation.appendInstruction(`${this.copy.userSentWhileWorking}\n${inputs.join('\n\n')}`)
    await this.warn('Đã nhận thêm tin nhắn của bạn', 'user_input')
    await this.checkpoint()
  }

  private tools() {
    return typeof this.input.tools === 'function' ? this.input.tools() : this.input.tools
  }

  private async checkpoint() {
    await this.onCheckpoint?.(this.conversation.checkpoint())
  }

  private async warn(content: string, kind: string) {
    await this.emit({ type: 'progress', content, metadata: { trace_kind: kind } })
  }

  private async callModel(toolsAllowed: boolean, forceTool?: string): Promise<Round> {
    const round = await executeModelRound(this.llm, {
      model: this.input.seed.model,
      signal: this.signal,
      emit: this.emit,
      conversation: this.conversation,
      tools: this.tools(),
      toolsAllowed,
      forceTool,
      outputTokens: this.input.seed.outputTokens,
      onSnipped: () => this.warn(this.copy.contextShortened, 'context_window_guard')
    })
    this.rounds++
    this.modelWaitMs += round.waitMs
    this.modelStreamMs += round.streamMs
    this.usage.prompt_tokens += round.usage.prompt_tokens
    this.usage.completion_tokens += round.usage.completion_tokens
    if (round.reasoning) this.reasoning += (this.reasoning ? '\n' : '') + round.reasoning
    this.response += round.text
    this.round = round
    return round
  }

  private async operate(operation: Operation, args: JsonRecord): Promise<unknown> {
    switch (operation) {
      // Hết lượt tổng hợp mà chưa xong ⇒ không thêm vòng "cứu" nữa, chuyển thẳng sang vòng chốt không tool
      case 'prepare_recovery':
        return { available: false, rejected: false }

      case 'begin_settlement':
        await this.warn('Đang tổng hợp câu trả lời…', 'settlement')
        this.conversation.appendInstruction(this.copy.settle)
        return null

      case 'call_round': {
        const settling = args.settling === true
        this.settling = settling
        if (this.rounds > 0) await this.takeInputs()
        const opening = !settling && this.rounds === 0 ? this.input.openingTool : undefined
        const round = await this.callModel(!settling && this.tools().length > 0, opening)
        this.conversation.appendAssistant(round)
        const truncated = isLength(round.finishReason)
        this.finishReason = truncated ? 'length' : round.finishReason === 'content_filter' ? 'content_filter' : 'stop'
        return {
          hasTools: round.toolCalls.length > 0,
          hasText: !!round.text.trim(),
          truncated,
          reasoningBudgetExhausted: truncated && !round.text.trim() && !!round.reasoning && !round.toolCalls.length
        }
      }

      case 'continue_truncated':
        await this.warn('Câu trả lời chạm giới hạn độ dài, đang viết tiếp…', 'output_truncated')
        this.conversation.appendInstruction(this.round?.text.trim() ? this.copy.continueTruncated : this.copy.continueReasoning)
        await this.checkpoint()
        return null

      case 'raise_reasoning_budget':
        throw new ReasoningBudgetExhausted()

      case 'recover_empty':
        this.conversation.appendInstruction(this.copy.emptyNudge)
        return null

      case 'check_finish': {
        const redirect = this.input.policy?.checkFinish?.(this.round?.text.trim() ?? '') ?? null
        this.redirect = redirect ?? ''
        return { redirect: !!redirect, override: false }
      }

      case 'redirect_finish':
        this.conversation.appendInstruction(this.redirect)
        return null

      // Chính sách từ chối hai lần: vẫn trả phần chữ đã có thay vì bỏ trắng
      case 'reject_finish':
        this.completed = this.response.trim().length > 0
        return null

      case 'finish':
        this.completed = true
        return null

      case 'dispatch_tools': {
        const round = this.round
        if (!round?.toolCalls.length) return { pause: false }
        this.conversation.beginTools(round.toolCalls)
        const outcome = await this.dispatcher.run(round.toolCalls, isLength(round.finishReason) ? this.copy.toolBatchTruncated : this.settling ? this.copy.toolsClosed : '')
        for (const call of round.toolCalls) this.conversation.resolveTool(call.id, outcome.results.get(call.id) ?? '{"error":"Công cụ không trả kết quả"}')
        this.executed = outcome.executed
        await this.checkpoint()
        return { pause: outcome.pause !== null }
      }

      // Lượt dừng ở câu hỏi cho người dùng; câu trả lời của họ là tin kế tiếp của cuộc trò chuyện
      case 'resolve_pause':
        this.askUser = this.dispatcher.pausePayload
        this.completed = true
        return false

      case 'after_tools':
        return { override: false, terminate: this.input.policy?.afterTools?.(this.executed).terminate === true }

      case 'terminate':
        this.completed = true
        return null

      case 'forced_finish': {
        this.conversation.appendInstruction(this.copy.finish)
        const round = await this.callModel(false)
        this.conversation.appendAssistant(round)
        this.finishReason = isLength(round.finishReason) ? 'length' : 'stop'
        this.completed = round.text.trim().length > 0
        return { extraRounds: 1 }
      }

      default:
        throw new Error(`Unsupported operation: ${operation}`)
    }
  }
}
