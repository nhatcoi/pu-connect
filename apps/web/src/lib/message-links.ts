// Nhận diện URL trong tin nhắn: cùng quy tắc với server (message-embed.service) ⇒ link bấm được và thẻ xem trước luôn khớp
// Same URL rules as the API so clickable links and preview cards always agree
const URL_SOURCE = String.raw`https?:\/\/[^\s<>"')\]]+`
const TRAILING_PUNCT = /[.,;:!?]+$/

export interface TextSegment {
  text: string
  url: string | null
}

// Tách nội dung thành đoạn chữ / URL (dấu câu cuối câu không thuộc URL)
export function splitByUrls(content: string): TextSegment[] {
  const out: TextSegment[] = []
  let last = 0
  for (const match of content.matchAll(new RegExp(URL_SOURCE, 'gi'))) {
    const url = match[0].replace(TRAILING_PUNCT, '')
    if (match.index! > last) out.push({ text: content.slice(last, match.index), url: null })
    out.push({ text: url, url })
    last = match.index! + url.length
  }
  if (last < content.length) out.push({ text: content.slice(last), url: null })
  return out
}

// Tin chỉ có đúng một URL (không chữ khác)
export function isLinkOnly(content: string): boolean {
  const segments = splitByUrls(content.trim())
  return segments.length === 1 && segments[0].url !== null
}
