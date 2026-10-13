import type { ChatAttachment } from '@pu/schemas'
import type OpenAI from 'openai'

type Part = OpenAI.Chat.Completions.ChatCompletionContentPart

const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_TEXT_BYTES = 200 * 1024
const TEXT_MIMES = ['text/plain', 'text/markdown', 'text/csv']

// Tệp đính kèm ⇒ phần nội dung cho LLM: ảnh (vision, base64) + văn bản thuần; định dạng khác chỉ nêu tên
// URL đã được kiểm tra thuộc R2 của mình khi gửi tin (không SSRF)
export async function attachmentParts(list: ChatAttachment[] | null): Promise<{ parts: Part[]; notes: string[] }> {
  const parts: Part[] = []
  const notes: string[] = []
  let images = 0
  for (const a of list || []) {
    try {
      if (a.kind === 'image' && images < MAX_IMAGES && a.size <= MAX_IMAGE_BYTES) {
        const buf = await download(a.url, MAX_IMAGE_BYTES)
        parts.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${buf.toString('base64')}` } })
        images++
      } else if (TEXT_MIMES.includes(a.mime) && a.size <= MAX_TEXT_BYTES) {
        const buf = await download(a.url, MAX_TEXT_BYTES)
        parts.push({ type: 'text', text: `<file name="${a.name.replace(/"/g, "'")}">\n${buf.toString('utf8')}\n</file>` })
      } else {
        notes.push(a.name)
      }
    } catch {
      notes.push(a.name)
    }
  }
  return { parts, notes }
}

async function download(url: string, maxBytes: number): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) throw new Error('too large')
  return buf
}
