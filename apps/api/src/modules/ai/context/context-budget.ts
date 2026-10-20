// Gói dữ liệu đưa vào prompt: cắt theo ngân sách ký tự, chặn thẻ giả mạo trong nội dung người dùng
// Prompt data helpers: char budget + neutralise fake closing tags inside user content

export const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

// Thuộc tính thẻ: bỏ dấu nháy / ngoặc nhọn
export const attr = (value: string): string => value.replace(/["<>]/g, "'")

const DATA_TAGS = /<(\/?)(post|thread|related|conversation|members|earlier|context|memory|skill|learner|user_profile)\b/gi

// Nội dung bài / bình luận / tin nhắn là DỮ LIỆU: không cho phép đóng thẻ khối bao quanh
export const dataText = (text: string): string => text.replace(DATA_TAGS, '‹$1$2')

// Lấy dòng theo thứ tự ưu tiên đến khi hết ngân sách (dòng đầu luôn giữ, cắt nếu quá dài)
export function fitLines(lines: string[], budget: number): string[] {
  const out: string[] = []
  let used = 0
  for (const line of lines) {
    const left = budget - used
    if (left <= 0) break
    const piece = out.length === 0 ? clip(line, left) : line
    if (out.length > 0 && piece.length > left) continue
    out.push(piece)
    used += piece.length + 1
  }
  return out
}
