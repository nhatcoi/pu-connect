import { CHAT_QUOTE_MAX_CHARS } from '@pu/schemas'

export interface SelectionInfo {
  text: string
  truncated: boolean
  locator?: string // "12:30" (phụ đề video) · "trang 5" (PDF), lấy từ [data-quote-at] gần nhất của điểm bắt đầu
  rect: DOMRect
}

const MIN_CHARS = 3

// Chữ đang bôi đen nằm trọn trong `root` ⇒ nội dung + vị trí; không có / ngoài vùng ⇒ null
export function readSelection(root: HTMLElement): SelectionInfo | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const clean = sel
    .toString()
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (clean.length < MIN_CHARS) return null
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  const start = range.startContainer
  const el = start.nodeType === Node.ELEMENT_NODE ? (start as Element) : start.parentElement
  const truncated = clean.length > CHAT_QUOTE_MAX_CHARS
  return {
    text: truncated ? `${clean.slice(0, CHAT_QUOTE_MAX_CHARS - 1)}…` : clean,
    truncated,
    locator: el?.closest<HTMLElement>('[data-quote-at]')?.dataset.quoteAt,
    rect
  }
}
