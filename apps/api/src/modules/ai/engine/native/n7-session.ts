/**
 * N7AI Agent Engine — N7AgentSession
 * Triển khai LoopHost để điều phối vòng lặp Agent với Conversation Context, ThinkFilter và ToolDispatcher.
 */
import type { LoopHost, LoopState, Operation, Operations } from '../core/contracts'
import { runLoop } from '../core/run-loop'
import { Conversation } from '../context/conversation'
import type { LlmService } from '../../llm.service'
import { ToolDispatcher } from '../tools/dispatcher'
import { executeModelRound } from './model-round'
import type { Emit, JsonRecord, N7AgentInput, N7AgentResult, Round, ToolSpec } from './types'

export class N7AgentSession implements LoopHost {
  private readonly conversation: Conversation
  private readonly dispatcher: ToolDispatcher
  private round: Round | undefined
  private response = ''
  private reasoning = ''
  private completed = false
  private tools: ToolSpec[]
  private state: LoopState = {
    rounds: 0,
    exploration_rounds: 0,
    settlement_rounds: 0,
    tool_steps: 0,
    reasoning_budget_recoveries: 0
  }

  constructor(
    private readonly llm: LlmService,
    private readonly input: N7AgentInput,
    private readonly emit: Emit,
    private readonly signal: AbortSignal,
    private readonly onCheckpoint?: (messages: any[]) => Promise<void>
  ) {
    this.conversation = new Conversation(input.seed)
    this.tools = input.tools
    this.dispatcher = new ToolDispatcher(this.tools, emit, signal, async (call, output) => {
      this.conversation.resolveTool(call.id, output.content)
      if (this.onCheckpoint) await this.onCheckpoint(this.conversation.checkpoint())
    })
  }

  async run(): Promise<N7AgentResult> {
    if (this.onCheckpoint) await this.onCheckpoint(this.conversation.checkpoint())
    this.state = await runLoop(this, this.input.config, this.signal)
    if (this.onCheckpoint) await this.onCheckpoint(this.conversation.checkpoint())

    return {
      state: this.state,
      response: this.response,
      reasoning: this.reasoning,
      completed: this.completed,
      sources: this.dispatcher.executedSources,
      usage: this.round?.usage || { prompt_tokens: 0, completion_tokens: 0 },
      toolCalls: this.dispatcher.calls,
      pausePayload: this.dispatcher.pausePayload
    }
  }

  async invoke<K extends Operation>(
    operation: K,
    args: Operations[K]['input'],
    state: Readonly<LoopState>
  ): Promise<Operations[K]['output']> {
    this.state = { ...state }
    return (await this.operate(operation, args)) as Operations[K]['output']
  }

  private async operate(operation: Operation, args: JsonRecord): Promise<unknown> {
    switch (operation) {
      case 'prepare_recovery':
        return { available: true, rejected: false }

      case 'begin_settlement':
        await this.emit({
          type: 'progress',
          content: 'Đang tổng hợp câu trả lời hoàn chỉnh...',
          metadata: { trace_kind: 'settlement_phase' }
        })
        return null

      case 'call_round': {
        const { settling, first } = args as { settling: boolean; first: boolean }
        const toolsAllowed = !settling && this.tools.length > 0 && !this.dispatcher.isPaused

        this.round = await executeModelRound(this.llm, {
          settling,
          first,
          model: this.input.seed.model,
          signal: this.signal,
          emit: this.emit,
          conversation: this.conversation,
          tools: this.tools,
          toolsAllowed
        })

        if (this.round.reasoning) {
          this.reasoning += (this.reasoning ? '\n' : '') + this.round.reasoning
        }

        if (this.round.text) {
          this.response += this.round.text
        }

        this.conversation.appendAssistant(this.round)

        return {
          hasTools: this.round.toolCalls.length > 0,
          hasText: Boolean(this.round.text),
          truncated: this.round.finishReason === 'length',
          reasoningBudgetExhausted: false
        }
      }

      case 'continue_truncated':
        await this.emit({
          type: 'progress',
          content: 'Tiếp tục hoàn thiện câu trả lời...',
          metadata: { trace_kind: 'resilience_truncated' }
        })
        this.conversation.appendInstruction('Tiếp tục viết câu trả lời một cách liền mạch từ điểm vừa dừng, không lặp lại đoạn trước.')
        return null

      case 'recover_empty':
        await this.emit({
          type: 'progress',
          content: 'Đang thử lại câu trả lời...',
          metadata: { trace_kind: 'resilience_empty' }
        })
        this.conversation.appendInstruction('Hãy cung cấp câu trả lời rõ ràng và chi tiết cho yêu cầu của người dùng.')
        return null

      case 'check_finish':
        return { redirect: false, override: false }

      case 'redirect_finish':
      case 'reject_finish':
        return null

      case 'finish':
        this.completed = true
        return null

      case 'dispatch_tools': {
        if (!this.round?.toolCalls.length) return { pause: false }
        this.conversation.beginTools(this.round.toolCalls)
        return await this.dispatcher.dispatch(this.round.toolCalls)
      }

      case 'resolve_pause':
        // Khi pause, lượt hiện tại dừng lại để trả options cho người dùng
        return false

      case 'after_tools':
        return { override: false, terminate: false }

      case 'terminate':
        this.completed = true
        return null

      case 'forced_finish':
        this.completed = true
        return { extraRounds: 0 }

      default:
        throw new Error(`Unsupported operation: ${operation}`)
    }
  }
}

