// Tách @username từ nội dung (username: a-z0-9_, 3-30 ký tự)
// Bỏ qua email (a@b.com) và URL (…/@user) nhờ yêu cầu ký tự đứng trước không phải chữ/số/@/./
const MENTION_RE = /(^|[^a-zA-Z0-9_@./])@([a-zA-Z0-9_]{3,30})(?![a-zA-Z0-9_])/g
export const MAX_MENTIONS_PER_SOURCE = 10

export function extractMentions(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(MENTION_RE)) {
      found.add(match[2].toLowerCase())
      if (found.size >= MAX_MENTIONS_PER_SOURCE) return [...found]
    }
  }
  return [...found]
}
