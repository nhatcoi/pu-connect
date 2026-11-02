import type { JsonRecord } from '../native/types'
import { record } from '../native/types'
import type { LoopCapability } from './types'
import { asList, fail, fences, ok, text, tool, wordCount } from './util'

const MAX_REPAIRS = 3
const WORDS_PER_SECOND = 2.5 // tốc độ đọc tiếng Việt ước lượng

/** Dùng chung: tool chốt nội dung (kiểm tra, sửa tối đa MAX_REPAIRS lần) → câu trả lời phải trình bày nội dung đã chốt */
class Gate<T> {
  value: T | null = null
  private repairs = 0
  private askedFor = false
  private asked = false

  constructor(private readonly check: (args: JsonRecord) => { value?: T; issues: string[] }, private readonly label: string) {}

  submit(args: JsonRecord, onOk: (value: T) => object): string {
    if (this.value) return fail(`${this.label} đã được chốt; trình bày nó cho người học, không tạo lại.`)
    const { value, issues } = this.check(args)
    if (issues.length && this.repairs < MAX_REPAIRS) {
      this.repairs++
      return fail(`${this.label} chưa đạt (lần sửa ${this.repairs}/${MAX_REPAIRS}):\n- ${issues.join('\n- ')}\nSửa rồi gọi lại.`)
    }
    if (!value) return fail(`${this.label} không hợp lệ: ${issues.join('; ')}`)
    this.value = value
    return ok({ status: 'accepted', ...onOk(value) })
  }

  nudge(missing: string, present: (answer: string) => string | null, answer: string): string | null {
    if (!this.value) {
      if (this.askedFor) return null
      this.askedFor = true
      return missing
    }
    if (this.asked) return null
    const issue = present(answer)
    if (issue) this.asked = true
    return issue
  }
}

// ─── Bài giảng video: kịch bản phân cảnh + thuyết minh ───
interface Scene {
  title: string
  narration: string
  visual: string
  seconds: number
}
interface Storyboard {
  title: string
  scenes: Scene[]
  total: number
}

export function storyboardIssues(args: JsonRecord): { value?: Storyboard; issues: string[] } {
  const issues: string[] = []
  const raw = asList(args.scenes).map(record)
  const scenes: Scene[] = raw.map((s) => {
    const narration = text(s.narration, 1200)
    return { title: text(s.title, 100), narration, visual: text(s.visual, 600), seconds: Math.max(3, Math.round(wordCount(narration) / WORDS_PER_SECOND)) }
  })
  if (scenes.length < 3 || scenes.length > 8) issues.push(`Cần 3–8 phân cảnh, hiện có ${scenes.length}.`)
  scenes.forEach((s, i) => {
    const n = i + 1
    const w = wordCount(s.narration)
    if (!s.title) issues.push(`Cảnh ${n}: thiếu title.`)
    if (!s.visual) issues.push(`Cảnh ${n}: thiếu visual (hình/hoạt họa hiện trên màn hình).`)
    if (w < 15 || w > 90) issues.push(`Cảnh ${n}: lời thuyết minh ${w} từ; cần 15–90 từ (khoảng 6–35 giây).`)
    if (/[*#`|]|https?:\/\//.test(s.narration)) issues.push(`Cảnh ${n}: lời thuyết minh còn ký hiệu markdown/URL; viết như lời nói.`)
  })
  if (scenes.length >= 2 && scenes[0].narration && scenes.slice(1).some((s) => s.narration === scenes[0].narration)) issues.push('Có cảnh lặp nguyên lời thuyết minh.')
  const total = scenes.reduce((n, s) => n + s.seconds, 0)
  return { value: scenes.length >= 3 ? { title: text(args.title, 120) || 'Bài giảng', scenes: scenes.slice(0, 8), total } : undefined, issues: issues.slice(0, 8) }
}

export function videoLessonCapability(): LoopCapability {
  const gate = new Gate<Storyboard>(storyboardIssues, 'Kịch bản')
  return {
    id: 'video_lesson',
    block: [
      'Chế độ BÀI GIẢNG VIDEO: hiện chưa dựng video; sản phẩm là kịch bản phân cảnh để dựng/hiển thị. Nói rõ điều này một câu cho người học.',
      'Gọi lesson_storyboard MỘT lần (3–8 cảnh). Mỗi cảnh: title ngắn; visual = hình/hoạt họa trên màn hình (một ý hình ảnh, cụ thể); narration = lời thuyết minh 15–90 từ viết như lời nói (không markdown, không URL, câu ngắn). Cảnh đầu nêu câu hỏi/hook, cảnh cuối tóm tắt; mỗi cảnh chỉ một ý.',
      'Sau khi được chấp nhận, trình bày kịch bản đúng theo nội dung đã chốt: tiêu đề, tổng thời lượng, rồi từng cảnh gồm tiêu đề, hình, lời thuyết minh, thời lượng.'
    ].join('\n'),
    tools: [
      tool(
        'lesson_storyboard',
        'Chốt kịch bản bài giảng video: tiêu đề và 3–8 phân cảnh (title, visual, narration). Hệ thống kiểm tra độ dài lời thuyết minh và tính thời lượng.',
        {
          title: { type: 'string' },
          scenes: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, visual: { type: 'string' }, narration: { type: 'string' } }, required: ['title', 'visual', 'narration'] } }
        },
        ['scenes'],
        (args) => gate.submit(args, (v) => ({ title: v.title, total_seconds: v.total, scenes: v.scenes.map((s, i) => ({ n: i + 1, title: s.title, seconds: s.seconds })) }))
      )
    ],
    budgets: { explorationBudget: 5 },
    policy: {
      checkFinish: (answer) =>
        gate.nudge(
          'Chưa chốt kịch bản. Gọi lesson_storyboard (title + 3–8 cảnh) rồi trình bày.',
          (a) => {
            const missing = gate.value!.scenes.filter((s) => !a.toLowerCase().includes(s.title.toLowerCase().slice(0, 14)))
            return missing.length ? `Câu trả lời thiếu cảnh: ${missing.map((s) => s.title).join('; ')}. Trình bày đủ ${gate.value!.scenes.length} cảnh đã chốt (tiêu đề, hình, lời thuyết minh, thời lượng).` : null
          },
          answer
        )
    }
  }
}

// ─── Tổng quan âm thanh: kịch bản đối thoại 2 giọng ───
interface Turn {
  speaker: 'A' | 'B'
  text: string
}
interface Dialogue {
  title: string
  turns: Turn[]
  seconds: number
}

export function dialogueIssues(args: JsonRecord): { value?: Dialogue; issues: string[] } {
  const issues: string[] = []
  const turns: Turn[] = asList(args.turns)
    .map(record)
    .map((t) => ({ speaker: (text(t.speaker, 8).toUpperCase().startsWith('B') ? 'B' : 'A') as 'A' | 'B', text: text(t.text, 800) }))
    .filter((t) => t.text)
  if (turns.length < 8 || turns.length > 30) issues.push(`Cần 8–30 lượt thoại, hiện có ${turns.length}.`)
  if (new Set(turns.map((t) => t.speaker)).size < 2) issues.push('Phải có cả hai giọng A và B.')
  let run = 1
  turns.forEach((t, i) => {
    const w = wordCount(t.text)
    if (w > 60) issues.push(`Lượt ${i + 1}: ${w} từ; tách thành các lượt ≤ 60 từ để đối thoại tự nhiên.`)
    if (/[*#`|_]|https?:\/\/|\[\d+\]/.test(t.text)) issues.push(`Lượt ${i + 1}: còn ký hiệu markdown/URL/trích dẫn; viết thuần lời nói.`)
    run = i > 0 && turns[i - 1].speaker === t.speaker ? run + 1 : 1
    if (run === 3) issues.push(`Lượt ${i + 1}: cùng một giọng nói 3 lượt liên tiếp; xen giọng còn lại.`)
  })
  const seconds = Math.round(turns.reduce((n, t) => n + wordCount(t.text), 0) / WORDS_PER_SECOND)
  return { value: turns.length >= 8 ? { title: text(args.title, 120) || 'Tổng quan âm thanh', turns: turns.slice(0, 30), seconds } : undefined, issues: issues.slice(0, 8) }
}

export function audioOverviewCapability(): LoopCapability {
  const gate = new Gate<Dialogue>(dialogueIssues, 'Kịch bản đối thoại')
  return {
    id: 'audio_overview',
    block: [
      'Chế độ TỔNG QUAN ÂM THANH: hiện chưa tạo file âm thanh; sản phẩm là kịch bản đối thoại 2 giọng (A dẫn dắt hỏi, B giải thích) để đọc/thu. Nói rõ một câu cho người học.',
      'Nếu người học có tài liệu/nguồn, đọc trước và chỉ nói điều có trong đó. Gọi audio_script MỘT lần: 8–30 lượt, mỗi lượt ≤ 60 từ, viết thuần lời nói (không markdown, URL, dấu sao, trích dẫn [n]); hai giọng xen kẽ; mở bằng câu dẫn vào chủ đề, giữa là 3–5 ý chính có ví dụ, cuối tóm tắt và một câu hỏi mở.',
      'Sau khi được chấp nhận, trình bày kịch bản đúng như đã chốt, mỗi dòng `A: …` hoặc `B: …`, kèm tiêu đề và thời lượng ước tính.'
    ].join('\n'),
    tools: [
      tool(
        'audio_script',
        'Chốt kịch bản đối thoại 2 giọng (A/B): tiêu đề và 8–30 lượt thoại. Hệ thống kiểm tra độ dài, xen giọng, ký hiệu không đọc được và ước tính thời lượng.',
        {
          title: { type: 'string' },
          turns: { type: 'array', items: { type: 'object', properties: { speaker: { type: 'string', enum: ['A', 'B'] }, text: { type: 'string' } }, required: ['speaker', 'text'] } }
        },
        ['turns'],
        (args) => gate.submit(args, (v) => ({ title: v.title, turns: v.turns.length, seconds: v.seconds }))
      )
    ],
    budgets: { explorationBudget: 5 },
    policy: {
      checkFinish: (answer) =>
        gate.nudge(
          'Chưa chốt kịch bản. Gọi audio_script (title + 8–30 lượt A/B) rồi trình bày.',
          (a) => {
            const lines = a.split('\n').filter((l) => /^\s*\**\s*[AB]\s*\**\s*[:：]/.test(l)).length
            return lines < gate.value!.turns.length * 0.8 ? `Câu trả lời mới có ${lines}/${gate.value!.turns.length} lượt thoại. Trình bày đủ kịch bản đã chốt, mỗi dòng "A: …" hoặc "B: …".` : null
          },
          answer
        )
    }
  }
}

// ─── Hoạt họa toán: mã Manim kiểm tra tĩnh ───
interface Manim {
  title: string
  className: string
  code: string
}

export function manimIssues(args: JsonRecord): { value?: Manim; issues: string[] } {
  const issues: string[] = []
  const code = text(args.code, 12000).replace(/^```\w*\n?|```$/g, '').trim()
  const cls = /^class\s+(\w+)\s*\(\s*(?:Scene|ThreeDScene|MovingCameraScene|ZoomedScene)\s*\)\s*:/m.exec(code)
  if (!/^from manim import \*|^import manim|^from manim import/m.test(code)) issues.push('Thiếu `from manim import *`.')
  if (!cls) issues.push('Cần đúng một lớp kế thừa Scene (hoặc ThreeDScene/MovingCameraScene): `class TenCanh(Scene):`.')
  if (!/def construct\(self\)\s*:/.test(code)) issues.push('Lớp thiếu `def construct(self):`.')
  if ((code.match(/class\s+\w+\s*\(\s*\w*Scene\s*\)/g)?.length ?? 0) > 1) issues.push('Chỉ một lớp Scene trong mỗi đoạn mã.')
  if (!/self\.play\(/.test(code)) issues.push('Chưa có `self.play(...)` nào: cảnh không có chuyển động.')
  if (/\b(import\s+(os|sys|subprocess|socket|shutil|requests)|__import__|eval\(|exec\(|open\()/.test(code)) issues.push('Không dùng os/sys/subprocess/network/eval/exec/open trong cảnh.')
  for (const [o, c] of ['()', '[]', '{}']) if ((code.match(new RegExp(`\\${o}`, 'g'))?.length ?? 0) !== (code.match(new RegExp(`\\${c}`, 'g'))?.length ?? 0)) issues.push(`Ngoặc ${o}${c} không cân.`)
  if (/\t/.test(code) && /^ +\S/m.test(code)) issues.push('Trộn tab và dấu cách khi thụt lề.')
  if (/MathTex\(\s*["'][^"']*[À-ỹ]/.test(code)) issues.push('MathTex/Tex không hiển thị chữ có dấu tiếng Việt; dùng Text(...) cho chữ thường, MathTex chỉ cho công thức.')
  return { value: cls && code ? { title: text(args.title, 120) || cls[1], className: cls[1], code } : undefined, issues: issues.slice(0, 8) }
}

export function mathAnimatorCapability(): LoopCapability {
  const gate = new Gate<Manim>(manimIssues, 'Mã Manim')
  return {
    id: 'math_animator',
    block: [
      'Chế độ HOẠT HỌA TOÁN: hiện chưa dựng video trên máy chủ; sản phẩm là mã Manim Community (Python) chạy được ở máy người học. Nói rõ một câu.',
      'Quy trình: nghĩ trước ý khái niệm (cần dựng gì, theo thứ tự nào), rồi gọi manim_scene MỘT lần với mã đầy đủ: `from manim import *`, MỘT lớp Scene có `construct`, mỗi bước dựng bằng self.play, có self.wait giữa các bước, tiêu đề đầu cảnh. Dùng Text cho chữ tiếng Việt, MathTex chỉ cho công thức (ASCII/LaTeX); không import ngoài manim/numpy/math; không đọc/ghi file, không mạng.',
      'Giữ cảnh 10–30 giây, một khái niệm, tối đa ~8 đối tượng cùng lúc, bố cục không chồng nhau (dùng next_to, arrange, to_edge). Sau khi được chấp nhận, trình bày: ý khái niệm (2–4 câu), mã trong khối ```python, và lệnh chạy `manim -pql tep.py TenLop`.'
    ].join('\n'),
    tools: [
      tool(
        'manim_scene',
        'Chốt mã Manim của cảnh hoạt họa: tiêu đề và mã Python đầy đủ. Hệ thống kiểm tra tĩnh cấu trúc, ngoặc, thư viện cấm.',
        { title: { type: 'string' }, code: { type: 'string', description: 'Mã Python đầy đủ, một lớp Scene.' } },
        ['code'],
        (args) => gate.submit(args, (v) => ({ title: v.title, class_name: v.className, run: `manim -pql scene.py ${v.className}` }))
      )
    ],
    openingTool: 'manim_scene',
    budgets: { explorationBudget: 6 },
    policy: {
      checkFinish: (answer) =>
        gate.nudge(
          'Chưa chốt mã. Gọi manim_scene (title + code) rồi trình bày.',
          (a) => (fences(a).some((b) => (b.lang === 'python' || b.lang === 'py') && b.body.includes(`class ${gate.value!.className}`)) ? null : `Câu trả lời thiếu khối \`\`\`python chứa lớp ${gate.value!.className}. Trình bày mã đã chốt cùng lệnh chạy.`),
          answer
        )
    }
  }
}
