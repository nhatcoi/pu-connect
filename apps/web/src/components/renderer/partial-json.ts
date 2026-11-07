// Đọc JSON đang stream dở: đóng chuỗi / ngoặc còn mở, bỏ phần đuôi chưa trọn ⇒ có dữ liệu để vẽ dần.

function closers(s: string): string {
  const stack: string[] = []
  let inStr = false
  let esc = false
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  return (inStr ? '"' : '') + stack.reverse().join('')
}

/** Trả về giá trị JSON parse được từ phần đầu của `src` (hoặc undefined nếu chưa có gì dùng được). */
export function parsePartialJson(src: string): unknown {
  const text = src.trim()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    /* tiếp tục sửa */
  }
  const floor = Math.max(1, text.length - 240)
  for (let cut = text.length; cut >= floor; cut--) {
    const head = text.slice(0, cut).replace(/[\s,:]+$/, '')
    if (!head) continue
    try {
      return JSON.parse(head + closers(head))
    } catch {
      /* cắt thêm */
    }
  }
  return undefined
}
