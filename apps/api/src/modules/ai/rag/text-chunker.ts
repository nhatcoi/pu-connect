// Cắt văn bản (đã làm sạch) thành đoạn cho RAG: gom theo đoạn văn tới ~TARGET ký tự, đoạn quá dài tách theo câu,
// mỗi đoạn mang theo phần cuối đoạn trước (OVERLAP) và đường dẫn tiêu đề mục chứa nó ("3. Đồ thị › 3.2 Dijkstra")
const TARGET = 1200
const MAX = 1600
const OVERLAP = 200
const MAX_HEADING_PATH = 160
export const MAX_CHUNKS = 300

export type TextChunk = { index: number; text: string; tokens: number; heading: string | null }

// Ước lượng token (tiếng Việt ~ 3–4 ký tự / token)
const estimateTokens = (s: string) => Math.ceil(s.length / 3.5)

// Nhận diện dòng tiêu đề (PDF không còn định dạng ⇒ dựa vào mẫu đánh số / chữ hoa) ⇒ cấp (nhỏ = cao)
export function headingLevel(line: string): number | null {
  if (line.length > 90) return null
  const md = /^(#{1,6})\s+\S/.exec(line)
  if (md) return md[1].length
  if (/[.,;]$/.test(line)) return null
  if (/^(chương|chapter|phần|part)\b/i.test(line)) return 1
  if (/^(lời giải|đáp án|hướng dẫn giải)?\s*(câu|bài|question)\s*\d+\b/i.test(line)) return 4
  const numbered = /^(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+\p{Lu}/u.exec(line)
  if (numbered) return 1 + numbered[1].split('.').length
  const letters = line.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 4 && letters.length <= 60 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return 1
  return null
}

const stripMarks = (line: string) =>
  line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .trim()

// Đoạn văn quá dài ⇒ tách theo câu, câu quá dài ⇒ cắt cứng
function pieces(paragraph: string): string[] {
  if (paragraph.length <= MAX) return [paragraph]
  const out: string[] = []
  for (const sentence of paragraph.split(/(?<=[.!?…;:])\s+/)) {
    for (let i = 0; i < sentence.length; i += MAX) out.push(sentence.slice(i, i + MAX))
  }
  return out
}

// Phần cuối đoạn trước, bắt đầu ở ranh giới từ
function tail(s: string): string {
  if (s.length <= OVERLAP) return s
  const cut = s.slice(-OVERLAP)
  const space = cut.indexOf(' ')
  return space > 0 ? cut.slice(space + 1) : cut
}

type Unit = { text: string; heading: string | null; section: boolean } // section: đơn vị mở đầu bằng dòng tiêu đề

// Dòng ⇒ đơn vị đoạn văn kèm đường dẫn tiêu đề đang có hiệu lực; dòng tiêu đề mở đơn vị mới
function units(text: string): Unit[] {
  const out: Unit[] = []
  const stack: { level: number; text: string }[] = []
  const path = () =>
    stack.length
      ? stack
          .map((h) => h.text)
          .join(' › ')
          .slice(0, MAX_HEADING_PATH)
      : null
  let buf: string[] = []
  let bufHeading: string | null = null
  let bufSection = false
  const flush = () => {
    const t = buf.join('\n').trim()
    if (t) pieces(t).forEach((p, i) => out.push({ text: p, heading: bufHeading, section: bufSection && i === 0 }))
    buf = []
  }
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/[ \t]+/g, ' ').trim()
    if (!line) {
      flush()
      continue
    }
    const level = headingLevel(line)
    if (level !== null) {
      flush()
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
      stack.push({ level, text: stripMarks(line) })
    }
    if (!buf.length) {
      bufHeading = path()
      bufSection = level !== null
    }
    buf.push(line)
  }
  flush()
  return out
}

// Mục mới (dòng tiêu đề) khi đoạn đang gom đã đủ dài ⇒ mở đoạn mới, không chồng lấn: mỗi mục / câu hỏi đứng đầu một đoạn
// Đoạn còn ngắn (mới có tiêu đề cha) ⇒ nhận đường dẫn tiêu đề cụ thể hơn của đơn vị sau
const SECTION_BREAK_MIN = 400

export function chunkText(text: string): TextChunk[] {
  const chunks: { text: string; heading: string | null }[] = []
  let current: { text: string; heading: string | null } | null = null
  for (const unit of units(text)) {
    const sectionBreak = unit.section && !!current && current.text.length >= SECTION_BREAK_MIN
    if (current && (sectionBreak || current.text.length + unit.text.length + 2 > TARGET)) {
      chunks.push(current)
      if (chunks.length >= MAX_CHUNKS) {
        current = null
        break
      }
      current = { text: sectionBreak ? unit.text : `${tail(current.text)}\n\n${unit.text}`, heading: unit.heading }
    } else if (current) {
      const specific = current.text.length < SECTION_BREAK_MIN && unit.heading && (!current.heading || unit.heading.startsWith(current.heading))
      current = { text: `${current.text}\n\n${unit.text}`, heading: specific ? unit.heading : current.heading }
    } else current = { text: unit.text, heading: unit.heading }
  }
  if (current && chunks.length < MAX_CHUNKS) chunks.push(current)
  return chunks.map((c, index) => ({ index, text: c.text, tokens: estimateTokens(c.text), heading: c.heading }))
}

// Có bị cắt bớt vì vượt số đoạn tối đa?
export const isTruncated = (chunks: TextChunk[]) => chunks.length >= MAX_CHUNKS
