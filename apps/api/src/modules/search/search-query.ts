// Phân tích câu tìm kiếm thành tsquery an toàn (chỉ [a-z0-9], không thể tiêm cú pháp)
// Parse user input into a safe prefix tsquery (ASCII-folded, injection-proof)

export interface ParsedQuery {
  // Từ khóa đã bỏ dấu, ngăn cách bởi 1 khoảng trắng (dùng cho LIKE / similarity)
  plain: string
  // 'tok1:* & tok2:*' cho to_tsquery('simple', …); null khi không có token hợp lệ
  tsquery: string | null
  // Truy vấn #tag: chỉ khớp chính xác tag (đã lowercase, bỏ dấu)
  tag: string | null
  isEmpty: boolean
}

const MAX_QUERY_LENGTH = 100
const MAX_TOKENS = 8

// Từ nối tiếng Việt (so khớp trên dạng CÓ DẤU: bỏ dấu trước sẽ nhầm "đề"→"de", "ôn"→"on")
// Lọc để câu tự nhiên ("tài liệu của môn giải tích") vẫn ra kết quả khi AND các từ
const STOPWORDS = new Set(['của', 'và', 'là', 'các', 'những', 'cho', 'với', 'có', 'không', 'một', 'trong', 'được', 'này', 'để', 'ở', 'thì', 'mà'])

// Bỏ dấu tiếng Việt: NFD + xóa dấu kết hợp + đ→d (khớp hành vi unaccent trong Postgres)
export function foldVietnamese(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

export function parseQuery(input: string): ParsedQuery {
  const lowered = (input || '').trim().slice(0, MAX_QUERY_LENGTH).normalize('NFC').toLowerCase()
  const isTag = lowered.startsWith('#')
  const words = (lowered.replace(/^[#@]+/, '').match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TOKENS)

  // Mỗi từ → bỏ dấu → chỉ giữ [a-z0-9] (chặn mọi ký tự cú pháp tsquery)
  const fold = (w: string) => foldVietnamese(w).replace(/[^a-z0-9]/g, '')

  if (isTag) {
    const tag = words.map(fold).find(Boolean) ?? null
    return { plain: tag ?? '', tsquery: null, tag, isEmpty: !tag }
  }

  const meaningful = words
    .filter((w) => !STOPWORDS.has(w))
    .map(fold)
    .filter(Boolean)
  const used = meaningful.length > 0 ? meaningful : words.map(fold).filter(Boolean)
  // 1 ký tự khớp gần như mọi thứ ⇒ coi là chưa đủ để tìm
  if (used.join('').length < 2) return { plain: '', tsquery: null, tag: null, isEmpty: true }
  return {
    plain: used.join(' '),
    tsquery: used.length > 0 ? used.map((t) => `${t}:*`).join(' & ') : null,
    tag: null,
    isEmpty: used.length === 0
  }
}
