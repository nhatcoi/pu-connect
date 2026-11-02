import type { JsonRecord } from '../native/types'
import { record } from '../native/types'
import type { LoopCapability } from './types'
import { asList, fail, ok, text, tool } from './util'

const MAX_SUBTOPICS = 5
const MAX_SOURCES = 40
const KNOWLEDGE_NOTE = /kiến thức nền|chưa tra được nguồn|không tra được nguồn|không có nguồn/i

interface Subtopic {
  id: string
  title: string
  query: string
  note: string | null
}
interface Source {
  n: number
  title: string
  url: string
}

const REFS_HEADING = /^#{1,4}\s*(tài liệu tham khảo|nguồn tham khảo|tham khảo|references)\b/im

/** Lỗi của báo cáo so với bằng chứng đã ghi; rỗng ⇒ đạt */
export function reportIssues(subtopics: Subtopic[], sources: Source[], answer: string): string[] {
  const out: string[] = []
  const cited = new Set([...answer.matchAll(/\[(\d{1,3})\]/g)].map((m) => Number(m[1])))
  const known = new Set(sources.map((s) => s.n))
  if (sources.length) {
    if (!cited.size) out.push('Báo cáo chưa có trích dẫn [n] nào. Mỗi kết luận quan trọng gắn [n] theo số thứ tự nguồn đã ghi.')
    const dangling = [...cited].filter((n) => !known.has(n))
    if (dangling.length) out.push(`Trích dẫn [${dangling.slice(0, 5).join('], [')}] không có trong danh sách nguồn (chỉ có 1–${sources.length}).`)
    if (!REFS_HEADING.test(answer)) out.push('Thiếu mục "## Tài liệu tham khảo" liệt kê các nguồn đã trích dẫn kèm đường dẫn.')
  } else if (!KNOWLEDGE_NOTE.test(answer)) {
    out.push('Chưa có nguồn ngoài nào. Nói rõ ở đầu báo cáo: nội dung dựa trên kiến thức nền, chưa tra được nguồn ngoài.')
  }
  const uncovered = subtopics.filter((s) => s.note && !answer.toLowerCase().includes(s.title.toLowerCase().slice(0, 12)))
  if (uncovered.length > 1) out.push(`Báo cáo chưa nhắc tới các ý đã nghiên cứu: ${uncovered.map((s) => s.title).join('; ')}.`)
  return out
}

/** Một lượt nghiên cứu: làm rõ đề tài → chia ý con → ghi bằng chứng từng ý (đánh số nguồn) → báo cáo có trích dẫn */
export class ResearchSession {
  topic = ''
  subtopics: Subtopic[] = []
  sources: Source[] = []
  private nudges = 0

  plan(args: JsonRecord): string {
    if (this.subtopics.length) return fail('Đã có kế hoạch; nghiên cứu từng ý con rồi ghi bằng research_note')
    this.topic = text(args.topic, 300)
    const raw = asList(args.subtopics).map((s) => (typeof s === 'string' ? { title: s, query: s } : record(s)))
    const list = raw
      .map((s) => ({ title: text(s.title ?? s.name, 120), query: text(s.query ?? s.title, 200) }))
      .filter((s) => s.title)
      .slice(0, MAX_SUBTOPICS)
    if (!this.topic || list.length < 2) return fail('Cần topic (đề tài đã làm rõ) và ít nhất 2 ý con, mỗi ý có title và query tra cứu.')
    this.subtopics = list.map((s, i) => ({ id: `t${i + 1}`, title: s.title, query: s.query || s.title, note: null }))
    return ok({
      status: 'planned',
      subtopics: this.subtopics.map((s) => ({ id: s.id, title: s.title, query: s.query })),
      instruction: 'Với MỖI ý con: tra cứu bằng công cụ sẵn có (ưu tiên nguồn học thuật/tài liệu của người học), rồi gọi research_note với phát hiện chính và nguồn. Xong tất cả ý con mới viết báo cáo.'
    })
  }

  note(args: JsonRecord): string {
    if (!this.subtopics.length) return fail('Chưa có kế hoạch. Gọi research_plan trước.')
    const id = text(args.subtopic_id, 8)
    const sub = this.subtopics.find((s) => s.id === id)
    if (!sub) return fail(`subtopic_id phải là một trong: ${this.subtopics.map((s) => s.id).join(', ')}`)
    const findings = text(args.findings, 3000)
    if (findings.length < 30) return fail('findings quá ngắn; ghi các phát hiện cụ thể (số liệu, định nghĩa, kết luận) của ý này.')
    const assigned: number[] = []
    for (const raw of asList(args.sources)) {
      const s = typeof raw === 'string' ? { url: raw, title: raw } : record(raw)
      const url = text(s.url ?? s.link, 500)
      const title = text(s.title, 200) || url
      if (!url && !title) continue
      const existing = this.sources.find((x) => (url && x.url === url) || (!url && x.title === title))
      if (existing) assigned.push(existing.n)
      else if (this.sources.length < MAX_SOURCES) {
        const n = this.sources.length + 1
        this.sources.push({ n, title, url })
        assigned.push(n)
      }
    }
    sub.note = findings
    const left = this.subtopics.filter((s) => !s.note)
    return ok({
      status: 'noted',
      subtopic: sub.title,
      source_numbers: assigned,
      remaining: left.map((s) => `${s.id}: ${s.title}`),
      instruction: left.length ? `Còn ${left.length} ý con chưa nghiên cứu.` : 'Đủ bằng chứng. Viết báo cáo: tóm tắt → từng ý con → đối chiếu/mâu thuẫn giữa nguồn → kết luận; trích dẫn [n] theo source_numbers; kết thúc bằng "## Tài liệu tham khảo".'
    })
  }

  finishNudge(answer: string): string | null {
    if (this.nudges >= 1) return null
    if (!this.subtopics.length) {
      this.nudges++
      return 'Chưa lập kế hoạch nghiên cứu. Gọi research_plan (đề tài đã làm rõ + 2–5 ý con), tra cứu từng ý, ghi research_note rồi mới viết báo cáo.'
    }
    const left = this.subtopics.filter((s) => !s.note)
    if (left.length) {
      this.nudges++
      return `Chưa nghiên cứu xong: ${left.map((s) => `${s.id} (${s.title})`).join('; ')}. Tra cứu và gọi research_note cho các ý này trước khi viết báo cáo.`
    }
    const issues = reportIssues(this.subtopics, this.sources, answer)
    if (!issues.length) return null
    this.nudges++
    const list = this.sources.map((s) => `[${s.n}] ${s.title}${s.url ? ` — ${s.url}` : ''}`).join('\n')
    return `Báo cáo chưa đạt:\n- ${issues.join('\n- ')}\n${list ? `Nguồn đã ghi:\n${list}\n` : ''}Viết lại báo cáo đầy đủ.`
  }
}

const RESEARCH_BLOCK = [
  'Chế độ NGHIÊN CỨU: quy trình bắt buộc.',
  '1) research_plan: nêu lại đề tài cụ thể hơn đề bài gốc (không dán nguyên văn) và chia 2–5 ý con độc lập, mỗi ý có truy vấn tra cứu. Đề tài đã rõ thì lập kế hoạch ngay; chỉ hỏi lại người học khi thiếu thông tin chặn việc nghiên cứu.',
  '2) Với mỗi ý con: tra cứu bằng công cụ sẵn có (ưu tiên nguồn học thuật và tài liệu của người học), KHÔNG trả lời từ trí nhớ; rồi gọi research_note (phát hiện cụ thể + nguồn có tiêu đề và URL).',
  '3) Báo cáo: tóm tắt, từng ý con, đối chiếu nguồn mâu thuẫn (nêu rõ ai nói gì), hạn chế của bằng chứng, kết luận. Mỗi kết luận quan trọng gắn trích dẫn [n] theo số thứ tự nguồn đã ghi; kết thúc bằng "## Tài liệu tham khảo" (số, tiêu đề, URL). Không bịa nguồn: không tra được thì nói rõ nội dung dựa trên kiến thức nền.'
].join('\n')

export function researchCapability(): LoopCapability {
  const session = new ResearchSession()
  return {
    id: 'research',
    block: RESEARCH_BLOCK,
    tools: [
      tool(
        'research_plan',
        'Lập kế hoạch nghiên cứu: đề tài đã làm rõ và 2–5 ý con độc lập kèm truy vấn tra cứu. Gọi một lần, ở đầu lượt.',
        {
          topic: { type: 'string', description: 'Đề tài cụ thể, có phạm vi.' },
          subtopics: {
            type: 'array',
            items: { type: 'object', properties: { title: { type: 'string' }, query: { type: 'string' } }, required: ['title'] },
            description: `2–${MAX_SUBTOPICS} ý con.`
          }
        },
        ['topic', 'subtopics'],
        (args) => session.plan(args)
      ),
      tool(
        'research_note',
        'Ghi bằng chứng của MỘT ý con sau khi tra cứu: phát hiện chính và các nguồn. Trả về số thứ tự nguồn để trích dẫn [n].',
        {
          subtopic_id: { type: 'string', description: 'Mã ý con từ research_plan, ví dụ t1.' },
          findings: { type: 'string', description: 'Phát hiện cụ thể: định nghĩa, số liệu, kết luận, điểm mâu thuẫn.' },
          sources: {
            type: 'array',
            items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } } },
            description: 'Các nguồn đã dùng cho ý này.'
          }
        },
        ['subtopic_id', 'findings'],
        (args) => session.note(args)
      )
    ],
    openingTool: 'research_plan',
    // plan + (tra cứu + note) × ≤5 ý con + dư cho sửa báo cáo
    budgets: { explorationBudget: 16 },
    policy: { checkFinish: (answer) => session.finishNudge(answer) }
  }
}
