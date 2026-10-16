// Câu hỏi gợi ý tiếp theo: LLM viết sau dấu mốc ở cuối câu trả lời (cùng 1 lượt gọi, không tốn thêm request)
// Follow-up suggestions: emitted after a marker in the same completion, hidden from the streamed text

export const FOLLOWUP_MARKER = '<<<FOLLOWUPS>>>'
const MAX_FOLLOWUPS = 3
const MAX_FOLLOWUP_LENGTH = 90

// Chỉ dẫn thêm vào system prompt của hội thoại PU AI riêng
export const FOLLOWUP_PROMPT = `
Sau khi trả lời xong, xuống dòng, viết đúng dòng ${FOLLOWUP_MARKER} rồi 3 câu hỏi tiếp theo người học có thể muốn hỏi (mỗi câu một dòng, bắt đầu bằng "- ", tối đa 12 từ, viết ở ngôi người học, đi sâu hơn hoặc mở rộng chủ đề vừa trả lời). Không viết gì sau 3 câu đó.`

// Tách luồng delta: phần hiển thị đi qua ngay; giữ lại đuôi có thể là đầu của dấu mốc
export class FollowUpSplitter {
  private visible = ''
  private held = ''
  private tail: string | null = null // nội dung sau dấu mốc

  // Trả về phần text được phép đẩy cho client ngay
  push(delta: string): string {
    if (this.tail !== null) {
      this.tail += delta
      return ''
    }
    const buf = this.held + delta
    const at = buf.indexOf(FOLLOWUP_MARKER)
    if (at !== -1) {
      this.tail = buf.slice(at + FOLLOWUP_MARKER.length)
      this.held = ''
      return this.emit(buf.slice(0, at))
    }
    const keep = partialMarkerSuffix(buf)
    this.held = buf.slice(buf.length - keep)
    return this.emit(buf.slice(0, buf.length - keep))
  }

  // Kết thúc luồng: phần còn giữ (không phải dấu mốc) + danh sách câu gợi ý
  finish(): { rest: string; text: string; followUps: string[]; memories: string[] } {
    const rest = this.tail === null ? this.held : ''
    this.visible += rest
    const tail = this.tail ?? ''
    return { rest, text: this.visible, followUps: parseFollowUps(tail), memories: parseMemories(tail) }
  }

  private emit(text: string): string {
    this.visible += text
    return text
  }
}

// Độ dài đuôi trùng với phần đầu của dấu mốc (vd. "...<<<FOLL")
function partialMarkerSuffix(buf: string): number {
  for (let n = Math.min(FOLLOWUP_MARKER.length - 1, buf.length); n > 0; n--) {
    if (FOLLOWUP_MARKER.startsWith(buf.slice(-n))) return n
  }
  return 0
}

// Dòng bộ nhớ sau dấu mốc: "[nhớ] <dữ kiện>"
const MEMORY_LINE = /^\s*\[nhớ\]\s*/i

export function parseMemories(raw: string): string[] {
  return raw
    .split('\n')
    .filter((line) => MEMORY_LINE.test(line))
    .map((line) => line.replace(MEMORY_LINE, '').trim())
    .filter((line) => line.length >= 3)
    .slice(0, 2)
}

export function parseFollowUps(raw: string): string[] {
  return raw
    .split('\n')
    .filter((line) => !MEMORY_LINE.test(line))
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
        .replace(/^["“]|["”]$/g, '')
        .replace(/\*\*/g, '')
        .trim()
    )
    .filter((line) => line.length >= 4 && line.length <= MAX_FOLLOWUP_LENGTH)
    .slice(0, MAX_FOLLOWUPS)
}

// Bộ nhớ dài hạn (chỉ hội thoại riêng, khi người dùng bật): ghi trong cùng lượt, sau dấu mốc
export const MEMORY_PROMPT = `
Nếu trong lượt này người học vừa cho biết dữ kiện BỀN về bản thân (ngành, khóa, môn đang học, lịch thi, mục tiêu, cách học ưa thích) mà phần <user_profile> chưa có, viết thêm tối đa 2 dòng dạng "[nhớ] <dữ kiện ngắn gọn, ngôi thứ ba>" ngay sau dòng ${FOLLOWUP_MARKER}, trước các câu hỏi gợi ý. Không ghi thông tin nhạy cảm (sức khỏe, tài chính, mật khẩu, số giấy tờ) hay chi tiết chỉ đúng trong câu hỏi này.`
