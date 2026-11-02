import type { JsonRecord } from '../native/types'
import { record } from '../native/types'
import type { LoopCapability } from './types'

const MAX_COUNT = 30
const DEFAULT_COUNT = 5
const MAX_TOPICS = 8
const MAX_REPAIRS = 3
const SIMILAR = 0.75
const SKEW = 0.6

const LEVELS = ['dễ', 'vừa', 'khó'] as const
type Level = (typeof LEVELS)[number]

interface Plan {
  title: string
  count: number
  level: Level
  topics: string[]
}

const ok = (data: unknown) => JSON.stringify({ ok: true, ...(data as object) })
const fail = (error: string) => JSON.stringify({ error })
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim()
const isCreateQuiz = (name: string) => name === 'create_quiz' || name.endsWith('__create_quiz')

const tokens = (v: string) => new Set(norm(v).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1))
function similarity(a: string, b: string): number {
  const x = tokens(a)
  const y = tokens(b)
  if (!x.size || !y.size) return 0
  let both = 0
  for (const t of x) if (y.has(t)) both++
  return both / (x.size + y.size - both)
}

/** Lỗi của bộ câu hỏi so với kế hoạch; rỗng ⇒ đạt. Chỉ soi chất lượng, cấu trúc cơ bản do tool lưu quiz tự kiểm. */
export function quizIssues(plan: Plan, raw: unknown): string[] {
  const out: string[] = []
  const qs = Array.isArray(raw) ? raw.map(record) : []
  if (qs.length !== plan.count) out.push(`Cần đúng ${plan.count} câu, hiện có ${qs.length}.`)

  const single: { n: number; answer: number; correctLen: number; maxLen: number; options: number }[] = []
  qs.forEach((q, i) => {
    const n = i + 1
    const options = Array.isArray(q.options) ? q.options.map((o) => text(o, 300)) : []
    const type = text(q.type, 12) || 'single'
    if (options.length >= 2 && new Set(options.map(norm)).size !== options.length) out.push(`Câu ${n}: có lựa chọn trùng nhau.`)
    if (text(q.explain, 1000).length < 5) out.push(`Câu ${n}: thiếu giải thích đáp án (explain).`)
    const answer = typeof q.answer === 'number' ? q.answer : -1
    if (type === 'single' && options.length >= 3 && answer >= 0 && answer < options.length) {
      const lens = options.map((o) => o.length)
      single.push({ n, answer, correctLen: lens[answer], maxLen: Math.max(...lens), options: options.length })
    }
    for (let j = 0; j < i; j++) {
      if (similarity(text(qs[j].q, 1000), text(q.q, 1000)) >= SIMILAR) {
        out.push(`Câu ${n} trùng ý với câu ${j + 1}; đổi sang khía cạnh khác.`)
        break
      }
    }
  })

  // Chỉ soi phân bố khi đủ nhiều câu một đáp án
  if (single.length >= 5) {
    const counts = new Map<number, number>()
    for (const s of single) counts.set(s.answer, (counts.get(s.answer) ?? 0) + 1)
    const [pos, top] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top / single.length > SKEW) out.push(`Đáp án đúng dồn vào vị trí ${String.fromCharCode(65 + pos)} (${top}/${single.length} câu); trải đều các vị trí.`)
    const longest = single.filter((s) => s.correctLen === s.maxLen && s.correctLen > 0).length
    if (longest / single.length > SKEW) out.push('Đáp án đúng thường là lựa chọn dài nhất; làm các lựa chọn sai dài và chi tiết tương đương.')
  }
  return out.slice(0, 8)
}

/** Trạng thái một lượt tạo quiz: kế hoạch → create_quiz kiểm tra chất lượng (sửa tối đa 3 lần) → đã lưu */
export class QuizSession {
  plan: Plan | null = null
  created = false
  private repairs = 0

  setPlan(args: JsonRecord): string {
    if (this.plan) return fail('Đã có kế hoạch; gọi create_quiz theo kế hoạch đó')
    const topics = (Array.isArray(args.topics) ? args.topics : []).map((t) => text(t, 80)).filter(Boolean).slice(0, MAX_TOPICS)
    const asked = typeof args.count === 'number' && Number.isFinite(args.count) ? Math.round(args.count) : DEFAULT_COUNT
    const count = Math.min(MAX_COUNT, Math.max(1, asked))
    const level = LEVELS.find((l) => l === text(args.level, 8)) ?? 'vừa'
    this.plan = { title: text(args.title, 120) || 'Quiz', count, level, topics }
    return ok({
      status: 'planned',
      plan: this.plan,
      instruction: `Gọi create_quiz với đúng ${count} câu, mức ${level}${topics.length ? `, phủ đủ các chủ đề: ${topics.join('; ')}` : ''}. Mỗi câu 4 lựa chọn khác nhau, có explain; đáp án đúng trải đều các vị trí và không luôn là lựa chọn dài nhất.`
    })
  }

  guard(name: string, args: JsonRecord): string | null {
    if (!isCreateQuiz(name)) return null
    if (!this.plan) return 'Chưa lập kế hoạch. Gọi quiz_plan trước (chủ đề, số câu, mức độ), rồi mới create_quiz.'
    if (this.created) return 'Bộ quiz đã được tạo; không tạo thêm trong lượt này.'
    if (this.repairs >= MAX_REPAIRS) return null
    const issues = quizIssues(this.plan, args.questions)
    if (!issues.length) return null
    this.repairs++
    return `Bộ câu hỏi chưa đạt (lần sửa ${this.repairs}/${MAX_REPAIRS}):\n- ${issues.join('\n- ')}\nSửa rồi gọi lại create_quiz với toàn bộ ${this.plan.count} câu.`
  }

  observe(name: string, result: string): void {
    if (!isCreateQuiz(name)) return
    try {
      const parsed = record(JSON.parse(result))
      if (!parsed.error && !parsed.isError) this.created = true
    } catch {
      this.created = true
    }
  }

  finishNudge(): string | null {
    if (this.created) return null
    if (!this.plan) return 'Bạn chưa tạo quiz. Gọi quiz_plan (chủ đề, số câu, mức độ) rồi create_quiz; đừng viết câu hỏi ra chữ.'
    return `Đã lập kế hoạch nhưng chưa lưu quiz. Gọi create_quiz với đúng ${this.plan.count} câu theo kế hoạch.`
  }
}

export function quizCapability(): LoopCapability {
  const session = new QuizSession()
  return {
    id: 'quiz',
    block: [
      'Quy trình TRẮC NGHIỆM: nếu người học có tài liệu hoặc nguồn, đọc trước để lấy nội dung. Gọi quiz_plan MỘT lần (tiêu đề, số câu, mức độ, các chủ đề), sau đó gọi create_quiz đúng một lần với đủ số câu đã chốt.',
      'Chất lượng: mỗi câu kiểm tra một ý riêng, 4 lựa chọn khác nhau và đều hợp lý, có explain, đáp án đúng trải đều các vị trí và không luôn là lựa chọn dài nhất. Không viết câu hỏi ra chữ thay cho create_quiz; không tiết lộ đáp án ngoài lệnh gọi.'
    ].join('\n'),
    tools: [
      {
        schema: {
          type: 'function',
          function: {
            name: 'quiz_plan',
            description: 'Lập kế hoạch bộ trắc nghiệm trước khi tạo: tiêu đề, số câu (mặc định 5), mức độ, các chủ đề cần phủ. Gọi một lần, trước create_quiz.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                count: { type: 'integer', description: `Số câu, 1–${MAX_COUNT}; theo yêu cầu của người học, mặc định ${DEFAULT_COUNT}.` },
                level: { type: 'string', enum: [...LEVELS] },
                topics: { type: 'array', items: { type: 'string' }, description: `Tối đa ${MAX_TOPICS} chủ đề sẽ được kiểm tra.` }
              },
              required: ['count']
            }
          }
        },
        run: (args) => session.setPlan(args)
      }
    ],
    guard: (name, args) => session.guard(name, args),
    observe: (name, result) => session.observe(name, result),
    policy: { checkFinish: () => session.finishNudge() }
  }
}
