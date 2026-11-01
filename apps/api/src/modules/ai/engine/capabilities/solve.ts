import type { JsonRecord } from '../native/types'
import { record } from '../native/types'
import type { CapabilityTool, LoopCapability } from './types'

const MAX_STEPS = 8
const MAX_REPLANS = 2

interface Step {
  id: string
  title: string
  done: boolean
  result: string
}

const ok = (data: unknown) => JSON.stringify({ ok: true, ...(data as object) })
const fail = (error: string) => JSON.stringify({ error })

/** Xương sống giải bài: kế hoạch đã chốt → từng bước có "cổng hoàn thành" → lập lại kế hoạch có giới hạn */
export class SolveSession {
  private steps: Step[] = []
  private replans = 0

  get planned() {
    return this.steps.length > 0
  }

  pending(): Step[] {
    return this.steps.filter((s) => !s.done)
  }

  private load(raw: unknown, keepDone: boolean): string | null {
    if (!Array.isArray(raw) || !raw.length) return 'steps phải là mảng không rỗng'
    const titles = raw
      .slice(0, MAX_STEPS)
      .map((x) => (typeof x === 'string' ? x : String(record(x).title ?? '')).trim())
      .filter(Boolean)
    if (!titles.length) return 'Mỗi bước cần có tiêu đề'
    const kept = keepDone ? this.steps.filter((s) => s.done) : []
    this.steps = [...kept, ...titles.map((title, i) => ({ id: `s${kept.length + i + 1}`, title, done: false, result: '' }))]
    return null
  }

  private view() {
    return { steps: this.steps.map((s) => ({ id: s.id, title: s.title, done: s.done })), remaining: this.pending().length }
  }

  plan(args: JsonRecord): string {
    if (this.planned) return fail('Đã có kế hoạch; dùng solve_finish_step hoặc solve_replan')
    const error = this.load(args.steps, false)
    return error ? fail(error) : ok(this.view())
  }

  finish(args: JsonRecord): string {
    const id = String(args.id ?? '')
    const step = this.steps.find((s) => s.id === id)
    if (!step) return fail(`Không có bước "${id}"`)
    step.done = true
    step.result = String(args.result ?? '').slice(0, 2000)
    return ok(this.view())
  }

  replan(args: JsonRecord): string {
    if (!this.planned) return fail('Chưa có kế hoạch để lập lại')
    if (this.replans >= MAX_REPLANS) return fail('Đã hết số lần lập lại kế hoạch; hoàn thành các bước còn lại hoặc kết luận bằng dữ liệu hiện có')
    const error = this.load(args.steps, true)
    if (error) return fail(error)
    this.replans++
    return ok({ ...this.view(), reason: String(args.reason ?? '').slice(0, 300) })
  }
}

const stepSchema = { type: 'object', properties: { title: { type: 'string', description: 'Việc cụ thể của bước' } }, required: ['title'] }

export function solveCapability(): LoopCapability {
  const session = new SolveSession()
  const tools: CapabilityTool[] = [
    {
      schema: {
        type: 'function',
        function: {
          name: 'solve_plan',
          description: 'Chốt kế hoạch giải bài (2–8 bước) trước khi tính toán. Chỉ gọi một lần; bài rất ngắn có thể bỏ qua.',
          parameters: { type: 'object', properties: { steps: { type: 'array', items: stepSchema } }, required: ['steps'] }
        }
      },
      run: (args) => session.plan(args)
    },
    {
      schema: {
        type: 'function',
        function: {
          name: 'solve_finish_step',
          description: 'Đánh dấu một bước đã xong kèm kết quả ngắn của bước đó.',
          parameters: { type: 'object', properties: { id: { type: 'string' }, result: { type: 'string' } }, required: ['id', 'result'] }
        }
      },
      run: (args) => session.finish(args)
    },
    {
      schema: {
        type: 'function',
        function: {
          name: 'solve_replan',
          description: 'Lập lại các bước CHƯA xong khi hướng đi sai (tối đa 2 lần). Bước đã xong được giữ nguyên.',
          parameters: { type: 'object', properties: { reason: { type: 'string' }, steps: { type: 'array', items: stepSchema } }, required: ['reason', 'steps'] }
        }
      },
      run: (args) => session.replan(args)
    }
  ]
  return {
    id: 'solve',
    block: [
      'Quy trình GIẢI BÀI có kế hoạch: với bài nhiều bước, gọi solve_plan một lần để chốt các bước; làm lần lượt và gọi solve_finish_step cho từng bước khi xong; nếu hướng đi sai thì solve_replan (tối đa 2 lần).',
      'Không kết luận khi còn bước chưa xong. Bài một bước đơn giản thì giải thẳng, không cần kế hoạch. Câu trả lời cuối trình bày đủ lời giải và kiểm tra lại kết quả.'
    ].join('\n'),
    tools,
    policy: {
      checkFinish: () => {
        const left = session.pending()
        return left.length ? `Còn ${left.length} bước chưa hoàn thành: ${left.map((s) => `${s.id} (${s.title})`).join('; ')}. Hoàn thành chúng (solve_finish_step) hoặc lập lại kế hoạch (solve_replan) trước khi trả lời cuối.` : null
      }
    }
  }
}
