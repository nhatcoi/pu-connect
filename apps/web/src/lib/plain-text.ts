// Markdown → văn bản thuần 1 dòng cho chỗ xem trước (danh sách hội thoại, trích dẫn, thông báo)
// Không cần chính xác tuyệt đối như trình render: chỉ bỏ ký hiệu để người đọc thấy chữ
const FENCE_LABELS: Record<string, string> = { quiz: '📝 Quiz', flashcards: '🗂️ Flashcard' }

export function markdownToPlainText(md: string): string {
  return (
    md
      // Khối code (PU AI trả quiz/flashcard dạng ```quiz) ⇒ nhãn ngắn
      .replace(/```(\w+)?[^\n]*\n?[\s\S]*?(```|$)/g, (_, lang?: string) => ` ${(lang && FENCE_LABELS[lang]) || '[code]'} `)
      .replace(/\$\$([\s\S]*?)\$\$/g, '$1') // công thức khối
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => alt || '🖼️') // ảnh
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // link
      .replace(/<[^>]+>/g, '') // thẻ HTML
      .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, '') // heading, trích dẫn, gạch đầu dòng
      .replace(/^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-*:?\s*$/gm, '') // dòng kẻ bảng
      .replace(/\|/g, ' ')
      .replace(/(\*\*|__|~~)(.+?)\1/g, '$2') // đậm, gạch
      .replace(/(^|[^\w*])[*_](?!\s)([^*_\n]+?)[*_](?=[^\w*]|$)/g, '$1$2') // nghiêng
      .replace(/`([^`]+)`/g, '$1') // code ngắn
      .replace(/\$([^$\n]+)\$/g, '$1') // công thức ngắn
      .replace(/\\%/g, '%')
      .replace(/\s+/g, ' ')
      .trim()
  )
}
