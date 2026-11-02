import type { JsonRecord } from '../native/types'
import type { LoopCapability } from './types'
import { asList, fail, fences, ok, text, tool } from './util'

export const RENDER_TYPES = ['mermaid', 'svg'] as const
export type RenderType = (typeof RENDER_TYPES)[number]

const MERMAID_HEADS = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram-v2', 'stateDiagram', 'erDiagram', 'gantt', 'mindmap', 'pie', 'journey', 'timeline', 'xychart-beta', 'quadrantChart']
const MAX_REPAIRS = 2

/** Lỗi của hình vẽ so với loại đã chọn; rỗng ⇒ hiển thị được. Soi cấu trúc, không soi thẩm mỹ. */
export function figureIssues(type: RenderType, answer: string): string[] {
  const blocks = fences(answer).filter((b) => b.lang === type || (type === 'svg' && b.lang === 'xml'))
  if (blocks.length === 0) return [`Thiếu khối \`\`\`${type}. Đặt đúng một khối code ${type} trong câu trả lời.`]
  if (blocks.length > 1) return [`Có ${blocks.length} khối ${type}; chỉ giữ MỘT hình duy nhất (chia vùng bên trong nếu cần).`]
  const code = blocks[0].body
  const out: string[] = []

  if (type === 'mermaid') {
    const first = code.split('\n').find((l) => l.trim())?.trim() ?? ''
    if (!MERMAID_HEADS.some((h) => first === h || first.startsWith(`${h} `) || first.startsWith(`${h}\t`))) out.push(`Dòng đầu phải là từ khóa Mermaid hợp lệ (${MERMAID_HEADS.slice(0, 8).join(' / ')}…), hiện là "${first.slice(0, 40)}".`)
    if (first === 'mindmap' && code.split('\n').filter((l) => l.trim() && !/^\s/.test(l)).length > 1) out.push('mindmap chỉ có MỘT nút gốc; các nhánh phải thụt lề.')
    if (/-->\s*\|[^|]*$/m.test(code)) out.push('Nhãn cạnh `|…|` chưa đóng.')
    return out
  }

  const svgs = code.match(/<svg[\s>]/g)?.length ?? 0
  if (svgs !== 1) out.push(`Cần đúng MỘT thẻ <svg>, hiện có ${svgs}.`)
  if (!/<svg[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(code)) out.push('Thẻ <svg> thiếu xmlns="http://www.w3.org/2000/svg".')
  if (!/<svg[^>]*\bviewBox="[\d.\s-]+"/.test(code)) out.push('Thẻ <svg> thiếu viewBox (viết đúng chữ hoa B), ví dụ viewBox="0 0 680 400".')
  if (/<script|\son\w+\s*=|javascript:/i.test(code)) out.push('Không dùng <script>, thuộc tính onclick…, hay javascript: trong SVG.')
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/i.test(code)) out.push('Có ký tự & chưa thoát; viết &amp;.')
  for (const tag of ['g', 'text', 'defs']) {
    const open = code.match(new RegExp(`<${tag}[\\s>]`, 'g'))?.length ?? 0
    const close = code.match(new RegExp(`</${tag}>`, 'g'))?.length ?? 0
    if (open !== close) out.push(`Thẻ <${tag}> mở ${open} đóng ${close}; cân lại thẻ.`)
  }
  if (/<text(?![^>]*\bclass=)/.test(code)) out.push('Mọi <text> cần class="t" | "th" | "ts" (không đặt màu/font cứng).')
  if (/<rect[^>]*\bwidth="100%"[^>]*fill=/.test(code)) out.push('Không vẽ hình nền; để nền trong suốt.')
  return out
}

const RULES = [
  'Chế độ TRỰC QUAN HÓA: tạo MỘT hình duy nhất, ngắn gọn, đúng ý người học. Gọi visualize_brief trước (loại hình, thể loại, mô tả, các thành phần), rồi viết hình trong đúng một khối code ở câu trả lời, kèm 1–3 câu giải thích bên ngoài hình.',
  'Chọn loại hình: ưu tiên mermaid cho sơ đồ có cấu trúc (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, mindmap, pie, timeline, xychart-beta cho biểu đồ số liệu đơn giản); dùng svg khi cần hình minh họa tự do, toạ độ tự chọn (cơ chế, cấu trúc lồng nhau, minh họa trực giác).',
  'Chọn theo ĐỘNG TỪ của người học, không theo chủ đề: "X hoạt động thế nào/hiểu trực giác" → svg minh họa cơ chế; "kiến trúc/gồm những phần nào" → mermaid hoặc svg cấu trúc; "quy trình/các bước" → mermaid flowchart; "so sánh số liệu" → mermaid xychart-beta/pie; "quan hệ/schema" → erDiagram/classDiagram.',
  'Ngân sách độ phức tạp: phụ đề trong hình ≤ 5 từ; tối đa 2–3 màu, màu mang ý nghĩa (nhóm cùng loại cùng màu, xám cho trung tính); một hàng tối đa 4 hộp; từ 6 thành phần trở lên thì vẽ bản tổng quan chỉ có luồng chính và nói người học có thể hỏi sâu từng nhánh. Nhãn viết hoa chữ đầu câu, không Title Case.',
  'Mermaid: dòng đầu là từ khóa loại sơ đồ; ID nút không có dấu cách (camelCase/gạch dưới), chữ hiển thị đặt trong ngoặc `id[Nhãn]`; nhãn ngắn; tránh ID trùng từ khóa end/graph/subgraph/class; mindmap có một gốc và thụt lề nhất quán.',
  'SVG: gốc `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">` (viewBox đặt đúng chữ hoa B, không width/height cố định); đúng MỘT thẻ svg; XML hợp lệ (đóng mọi thẻ, thuộc tính có ngoặc kép, & viết &amp;); không hình nền, không màu/font cứng. Dùng lớp có sẵn: chữ `t` (14px) `th` (tiêu đề) `ts` (12px, phụ đề) — mọi <text> phải có một lớp; hộp `box`; mũi tên `arr` kèm marker-end="url(#arrow)"; màu `c-gray c-blue c-teal c-coral c-pink c-purple c-green c-amber c-red` đặt trên <g> bọc hình + chữ (chữ tự đổi màu theo). Khai báo marker một lần: `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker></defs>`.',
  'SVG tính toán trước khi vẽ: bề rộng hộp = max(số ký tự tiêu đề×8, phụ đề×7)+24; hàng N hộp phải vừa x=40..640; mũi tên không cắt qua hộp khác; <text> không tự xuống dòng (dùng <tspan dy="1.2em">); chữ căn giữa hộp: x = tâm hộp, text-anchor="middle", y = tâm; viewBox cao = đáy phần tử thấp nhất + 40.',
  'Không dùng <script> hay onclick. Không tự chế dữ liệu thật: số liệu minh họa phải ghi rõ là minh họa.'
].join('\n')

export class VisualizeSession {
  type: RenderType | null = null
  private repairs = 0

  brief(args: JsonRecord): string {
    const requested = text(args.render_type, 10).toLowerCase()
    const type = RENDER_TYPES.find((t) => t === requested)
    if (!type) return fail(`render_type phải là một trong: ${RENDER_TYPES.join(', ')}`)
    this.type = type
    const elements = asList(args.elements).map((e) => text(e, 80)).filter(Boolean).slice(0, 12)
    return ok({
      status: 'briefed',
      render_type: type,
      genre: text(args.genre, 20) || null,
      elements,
      instruction: `Viết hình ${type} trong đúng một khối \`\`\`${type}, theo thể loại đã chọn${elements.length ? ` và gồm: ${elements.join('; ')}` : ''}. Sau hình, giải thích ngắn 1–3 câu.`
    })
  }

  finishNudge(answer: string): string | null {
    if (!this.type) return 'Chưa chọn loại hình. Gọi visualize_brief (render_type mermaid hoặc svg), rồi viết hình trong một khối code.'
    if (this.repairs >= MAX_REPAIRS) return null
    const issues = figureIssues(this.type, answer)
    if (!issues.length) return null
    this.repairs++
    return `Hình ${this.type} chưa đạt:\n- ${issues.join('\n- ')}\nViết lại câu trả lời với MỘT khối \`\`\`${this.type} đã sửa (và vài câu giải thích ngắn).`
  }
}

export function visualizeCapability(): LoopCapability {
  const session = new VisualizeSession()
  return {
    id: 'visualize',
    block: RULES,
    tools: [
      tool(
        'visualize_brief',
        'Chốt cách vẽ trước khi viết hình: loại hình (mermaid hoặc svg), thể loại, mô tả, các thành phần chính. Gọi một lần ở đầu lượt.',
        {
          render_type: { type: 'string', enum: [...RENDER_TYPES], description: 'mermaid cho sơ đồ có cấu trúc/biểu đồ đơn giản; svg cho minh họa tự do.' },
          genre: { type: 'string', enum: ['flowchart', 'structural', 'illustrative', 'chart', 'art'], description: 'Hình dùng để làm gì (theo động từ của người học).' },
          description: { type: 'string', description: 'Hình cần thể hiện điều gì.' },
          elements: { type: 'array', items: { type: 'string' }, description: 'Các thành phần chính (tối đa 12).' }
        },
        ['render_type'],
        (args) => session.brief(args)
      )
    ],
    openingTool: 'visualize_brief',
    budgets: { explorationBudget: 4 },
    policy: { checkFinish: (answer) => session.finishNudge(answer) }
  }
}
