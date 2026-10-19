// Cắt văn bản tài liệu thành đoạn cho RAG: gom theo đoạn văn tới ~TARGET ký tự, đoạn quá dài tách theo câu,
// mỗi đoạn mang theo phần cuối đoạn trước (OVERLAP) để ý nối giữa hai đoạn không bị mất
const TARGET = 1200
const MAX = 1600
const OVERLAP = 200
export const MAX_CHUNKS = 300

export type TextChunk = { index: number; text: string; tokens: number }

// Ước lượng token (tiếng Việt ~ 3–4 ký tự / token)
const estimateTokens = (s: string) => Math.ceil(s.length / 3.5)

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

export function chunkText(text: string): TextChunk[] {
  const parts = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .flatMap(pieces)
  const chunks: string[] = []
  let current = ''
  for (const part of parts) {
    if (current && current.length + part.length + 2 > TARGET) {
      chunks.push(current)
      if (chunks.length >= MAX_CHUNKS) break
      current = `${tail(current)}\n\n${part}`
    } else current = current ? `${current}\n\n${part}` : part
  }
  if (current && chunks.length < MAX_CHUNKS) chunks.push(current)
  return chunks.map((t, index) => ({ index, text: t, tokens: estimateTokens(t) }))
}
