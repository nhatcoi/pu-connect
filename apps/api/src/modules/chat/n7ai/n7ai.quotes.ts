import type { ChatQuote } from '@pu/schemas'

const HISTORY_SNIPPET = 300 // lượt cũ chỉ nhắc lại ngắn gọn để câu hỏi nối tiếp ("đoạn tiếp theo?") vẫn hiểu

const attr = (s: string) => s.replace(/"/g, "'")
// Chữ của người dùng không được đóng thẻ sớm
const body = (s: string) => s.replace(/<\/(passage|selected_passages)/gi, '<\\/$1')

// Đoạn người dùng bôi đen trong tài liệu ⇒ khối nội dung đứng trước câu hỏi của lượt hiện tại
export function quotesBlock(quotes: ChatQuote[]): string {
  if (!quotes.length) return ''
  const items = quotes.map((q) => `<passage source="${attr(q.title)}"${q.locator ? ` at="${attr(q.locator)}"` : ''}>\n${body(q.text)}\n</passage>`)
  return `<selected_passages note="Người dùng bôi đen các đoạn sau trong tài liệu để hỏi. Ưu tiên trả lời về chính các đoạn này; khi dẫn lại, nêu tên tài liệu và vị trí (mốc thời gian hoặc trang).">\n${items.join('\n')}\n</selected_passages>\n\n`
}

// Lượt cũ trong lịch sử: chỉ ghi nhận có đoạn trích kèm theo
export function quotesHistoryNote(quotes: ChatQuote[] | null | undefined): string {
  if (!quotes?.length) return ''
  const items = quotes.map((q) => {
    const text = q.text.replace(/\s+/g, ' ')
    return `"${text.length > HISTORY_SNIPPET ? `${text.slice(0, HISTORY_SNIPPET)}…` : text}" (${q.title}${q.locator ? `, ${q.locator}` : ''})`
  })
  return ` [đã chọn đoạn: ${items.join('; ')}]`
}
