import type { ActionDraft } from './agent/ai-actions'
import { MAX_ACTIONS, parseActionLines } from './agent/ai-actions'

// Câu hỏi gợi ý tiếp theo: LLM viết sau dấu mốc ở cuối câu trả lời (cùng 1 lượt gọi, không tốn thêm request)
// Follow-up suggestions: emitted after a marker in the same completion, hidden from the streamed text

export const FOLLOWUP_MARKER = '<<<FOLLOWUPS>>>'
const MAX_FOLLOWUPS = 3
const MAX_FOLLOWUP_LENGTH = 90

// Chỉ dẫn thêm vào system prompt của hội thoại N7AI riêng
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

  // Kết thúc luồng: phần còn giữ (không phải dấu mốc) + câu gợi ý, bộ nhớ, số nguồn đã dùng, nút (chưa kiểm nhóm học)
  finish(): { rest: string; text: string; followUps: string[]; memories: string[]; cited: number[]; actions: ActionDraft[] } {
    const rest = this.tail === null ? this.held : ''
    this.visible += rest
    const tail = this.tail ?? ''
    return {
      rest,
      text: this.visible,
      followUps: parseFollowUps(tail),
      memories: parseMemories(tail),
      cited: parseCited(tail),
      actions: parseActionLines(tail)
    }
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

// Dòng nguồn sau dấu mốc: "[nguồn] 1, 3" = số n của <data> N7AI thực sự dùng
const SOURCE_LINE = /^\s*\[ngu[ồo]n\]\s*:?\s*/i

export function parseCited(raw: string): number[] {
  const line = raw.split('\n').find((l) => SOURCE_LINE.test(l))
  if (!line) return []
  const nums = (line.replace(SOURCE_LINE, '').match(/\d+/g) ?? []).map(Number).filter((n) => n >= 1)
  return Array.from(new Set(nums))
}

// Dòng dữ liệu có nhãn ([nhớ], [nguồn], [mở], [tham gia]…) không phải câu hỏi gợi ý
const TAGGED_LINE = /^\s*\[[^\]\n]{1,16}\]/

export function parseFollowUps(raw: string): string[] {
  return raw
    .split('\n')
    .filter((line) => !TAGGED_LINE.test(line))
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

// Ghi nguồn đã dùng (khi có <context>): chỉ hiện nguồn N7AI thực sự dựa vào, không phải mọi kết quả tìm được
export const SOURCES_PROMPT = `
Mỗi nguồn trong <context> hoặc kết quả công cụ có trường n là số thứ tự nguồn. Chỉ các nguồn được cấp n mới được ghi số nguồn. Sau khi trả lời, xuống dòng, viết dòng ${FOLLOWUP_MARKER} rồi ngay dòng sau viết "[nguồn] <các số n bạn thực sự dùng để trả lời, cách nhau dấu phẩy>" (trước mọi dòng khác sau dấu mốc). Nguồn không liên quan thì bỏ qua, không nhắc tới trong câu trả lời; không dùng nguồn nào thì không viết dòng [nguồn]. Không ghi số n trong phần trả lời.`

// Nút dẫn đường / hành động cần xác nhận (thread riêng, có tool puc__*): cú pháp xem agent/ai-actions.ts
export const ACTIONS_PROMPT = `
Khi câu trả lời hướng người học tới một trang / tính năng trong PU Connector (kết quả từ công cụ puc__*), sau dòng ${FOLLOWUP_MARKER} có thể thêm tối đa ${MAX_ACTIONS} dòng nút (trước các câu hỏi gợi ý):
- "[mở] <nhãn ngắn> | <đường dẫn>": đường dẫn lấy đúng trường href trong kết quả công cụ (vd. /courses/IT101, /tools/flashcards). Không bịa đường dẫn.
- "[tham gia] <id nhóm học>": chỉ khi người học muốn tham gia một nhóm học đang tuyển (status recruiting) trong kết quả puc__search; người học sẽ tự bấm xác nhận.
Không có trang phù hợp thì không viết dòng nút.`
