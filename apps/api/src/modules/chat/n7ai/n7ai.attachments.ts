import type { ChatAttachment } from '@pu/schemas'
import type OpenAI from 'openai'
import { bufferToText, isBinaryDocMime, isExtractableMime } from '../../ai/doc-text'

type Part = OpenAI.Chat.Completions.ChatCompletionContentPart

const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_TEXT_BYTES = 200 * 1024
const MAX_DOC_BYTES = 20 * 1024 * 1024
// Giới hạn ký tự đưa vào prompt (tránh tràn context) / Prompt budget
const MAX_CHARS_PER_FILE = 40_000
const MAX_CHARS_TOTAL = 80_000

// Tệp N7AI đọc được nội dung (dùng để tìm "tài liệu đang thảo luận")
export const isReadableDoc = (a: ChatAttachment) => isExtractableMime(a.mime)

// Cache văn bản đã trích theo key R2 (hỏi tiếp về cùng tài liệu không phải tải/parse lại)
const textCache = new Map<string, string>()
const CACHE_SIZE = 30

// Tệp đính kèm ⇒ phần nội dung cho LLM: ảnh (vision, base64) + văn bản (txt/md/csv/pdf/docx); còn lại chỉ nêu tên
// URL đã được kiểm tra thuộc R2 của mình khi gửi tin (không SSRF)
export async function attachmentParts(list: ChatAttachment[] | null, opts: { images?: boolean } = {}): Promise<{ parts: Part[]; notes: string[] }> {
  const parts: Part[] = []
  const notes: string[] = []
  let images = 0
  let budget = MAX_CHARS_TOTAL
  for (const a of list || []) {
    try {
      if (a.kind === 'image') {
        if (opts.images === false) continue
        if (images >= MAX_IMAGES || a.size > MAX_IMAGE_BYTES) {
          notes.push(a.name)
          continue
        }
        const buf = await download(a.url, MAX_IMAGE_BYTES)
        parts.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${buf.toString('base64')}` } })
        images++
        continue
      }
      if (!isReadableDoc(a) || budget <= 0) {
        notes.push(a.name)
        continue
      }
      const raw = await extractText(a)
      if (!raw.trim()) {
        notes.push(`${a.name} (không có lớp chữ, có thể là bản scan)`)
        continue
      }
      const limit = Math.min(MAX_CHARS_PER_FILE, budget)
      const text = raw.length > limit ? `${raw.slice(0, limit)}\n…(đã cắt bớt, tài liệu dài ${raw.length} ký tự)` : raw
      budget -= text.length
      parts.push({ type: 'text', text: `<file name="${a.name.replace(/"/g, "'")}">\n${text}\n</file>` })
    } catch {
      notes.push(a.name)
    }
  }
  return { parts, notes }
}

// Trích văn bản theo loại tệp (có cache) / Extract text by MIME
async function extractText(a: ChatAttachment): Promise<string> {
  const cached = textCache.get(a.key)
  if (cached !== undefined) return cached

  const limit = isBinaryDocMime(a.mime) ? MAX_DOC_BYTES : MAX_TEXT_BYTES
  const text = await bufferToText(await download(a.url, limit), a.mime)

  textCache.set(a.key, text)
  if (textCache.size > CACHE_SIZE) textCache.delete(textCache.keys().next().value as string)
  return text
}

async function download(url: string, maxBytes: number): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) throw new Error('too large')
  return buf
}
