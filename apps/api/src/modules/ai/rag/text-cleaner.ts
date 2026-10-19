// Làm sạch chữ trích từ tệp trước khi cắt đoạn / embedding (RAG)
// NFC (dấu tiếng Việt tách rời ⇒ full-text trượt), bỏ header/footer lặp mỗi trang, số trang, nối dòng bị ngắt giữa câu,
// nhận diện trang chữ rác (font TCVN3 / VNI cũ) và trang không có lớp chữ (scan) ⇒ đưa đi OCR

const MIN_PAGE_CHARS = 30 // ít hơn ⇒ coi là trang scan
const GARBLED_RATIO = 0.03
const REPEAT_MIN_PAGES = 3
const REPEAT_RATIO = 0.5
const EDGE_LINES = 2 // header/footer = 2 dòng đầu / cuối trang

// Ký tự Latin-1 không thuộc bảng chữ tiếng Việt: dấu hiệu chữ TCVN3 / VNI hiển thị bằng font Unicode (vd. "Tr­êng §¹i häc")
const VIET_LATIN1 = new Set([...'àáâãèéêìíòóôõùúýÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝ'])
const isSuspicious = (ch: string) => {
  const code = ch.charCodeAt(0)
  return (
    ch === '\uFFFD' ||
    (code >= 0xa1 && code <= 0xff && !VIET_LATIN1.has(ch) && ch !== '×' && ch !== '÷' && ch !== '°' && ch !== '±' && ch !== '²' && ch !== '³')
  )
}

export function isGarbled(text: string): boolean {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '')
  if (letters.length < 40) return false
  let bad = 0
  for (const ch of letters) if (isSuspicious(ch)) bad++
  return bad / letters.length > GARBLED_RATIO
}

export const needsOcr = (page: string) => page.replace(/\s/g, '').length < MIN_PAGE_CHARS || isGarbled(page)

// Khóa so dòng lặp: bỏ số (số trang đổi theo trang), khoảng trắng
const lineKey = (line: string) => line.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase()
const PAGE_NUMBER = /^(trang\s*)?#(\s*(\/|of|trên)\s*#)?$/i

// Dòng xuất hiện ở mép (đầu/cuối) của ≥ 50% số trang ⇒ header/footer
function repeatedEdges(pages: string[][]): Set<string> {
  const counts = new Map<string, number>()
  for (const lines of pages) {
    const edges = new Set([...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)].map(lineKey).filter((k) => k.length >= 3))
    for (const k of edges) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const out = new Set<string>()
  if (pages.length < REPEAT_MIN_PAGES) return out
  for (const [k, n] of counts) if (n >= REPEAT_MIN_PAGES && n / pages.length >= REPEAT_RATIO) out.add(k)
  return out
}

// Dòng bị ngắt giữa câu: dòng trước không kết thúc câu / không phải tiêu đề, dòng sau bắt đầu bằng chữ thường
const ENDS_SENTENCE = /[.!?:;…)\]"”]$/
const STARTS_LOWER = /^[\p{Ll}(“"]/u
const LIST_ITEM = /^([-–•*+]|\d+[.)]|[a-zđ][.)])\s/i

function joinWrapped(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    if (prev && line && !ENDS_SENTENCE.test(prev) && STARTS_LOWER.test(line) && !LIST_ITEM.test(line)) {
      out[out.length - 1] = prev.endsWith('-') && /\p{L}-$/u.test(prev) ? prev.slice(0, -1) + line : `${prev} ${line}`
    } else out.push(line)
  }
  return out
}

// Các trang ⇒ văn bản sạch (trang cách nhau bằng dòng trống)
export function cleanPages(pages: string[]): string {
  const split = pages.map((p) =>
    p
      .normalize('NFC')
      // eslint-disable-next-line no-control-regex -- cố ý: bỏ ký tự điều khiển / vô hình do trích PDF sinh ra
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u00AD\u200B-\u200D\uFEFF]/g, '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((l) => l.replace(/[ \t\u00A0]+/g, ' ').trim())
  )
  const repeated = repeatedEdges(split.map((lines) => lines.filter(Boolean)))
  return split
    .map((lines) => {
      const kept = lines.filter((l) => !l || (!repeated.has(lineKey(l)) && !PAGE_NUMBER.test(lineKey(l))))
      return joinWrapped(kept).join('\n')
    })
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
