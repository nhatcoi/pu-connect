import type { AiSourceMeta } from '@pu/schemas'
import type OpenAI from 'openai'

type Part = OpenAI.Chat.Completions.ChatCompletionContentPart

export interface SourceText {
  title: string
  kind: 'text' | 'url' | 'youtube'
  url: string | null
  content: string
  meta?: AiSourceMeta | null
}

const MAX_CHARS_PER_SOURCE = 30_000
const MAX_CHARS_TOTAL = 60_000
const KIND_LABEL: Record<SourceText['kind'], string> = { text: 'văn bản', url: 'trang web', youtube: 'video YouTube' }
const attr = (s: string) => s.replace(/"/g, "'")

// Tài liệu dạng chữ của cuộc trò chuyện ⇒ phần nội dung cho LLM, trong ngân sách ký tự (nguồn mới nhất được ưu tiên)
export function sourceTextParts(texts: SourceText[]): Part[] {
  const parts: Part[] = []
  let budget = MAX_CHARS_TOTAL
  for (const t of texts) {
    if (budget <= 0) break
    const limit = Math.min(MAX_CHARS_PER_SOURCE, budget)
    const body = t.content.length > limit ? `${t.content.slice(0, limit)}\n…(đã cắt bớt, nguồn dài ${t.content.length} ký tự)` : t.content
    budget -= body.length
    const from = t.url ? ` url="${attr(t.url)}"` : ''
    parts.push({ type: 'text', text: `<source name="${attr(t.title)}" type="${KIND_LABEL[t.kind]}"${from}>\n${t.kind === 'youtube' ? `${videoHeader(t.meta)}\n` : ''}${body}\n</source>` })
  }
  return parts
}

// Video: nói rõ nguồn là phụ đề có mốc thời gian để N7AI dẫn lại đúng đoạn
function videoHeader(meta?: AiSourceMeta | null): string {
  const by = [meta?.author && `kênh ${meta.author}`, meta?.seconds && `dài ${Math.round(meta.seconds / 60)} phút`, meta?.lang && `phụ đề ${meta.auto ? 'tự động ' : ''}${meta.lang}`].filter(Boolean).join(', ')
  return `(Phụ đề video${by ? `, ${by}` : ''}. Mỗi đoạn bắt đầu bằng mốc [mm:ss]; khi trả lời dựa vào video, dẫn mốc thời gian đó, ví dụ [12:30].)`
}
