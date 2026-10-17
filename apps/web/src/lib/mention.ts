import type { MentionCandidate } from '@pu/schemas'

export const N7AI_USERNAME = 'n7ai'
export const N7AI_MENTION = /(^|\s)@n7ai\b/i

// N7AI luôn ghim đầu danh sách gợi ý (bot không nằm trong kết quả server)
export const N7AI_CANDIDATE: MentionCandidate = {
  id: 'n7ai',
  username: N7AI_USERNAME,
  displayName: 'N7AI',
  avatarUrl: null,
  reason: 'other'
}

export interface ActiveMention {
  start: number // vị trí ký tự @
  end: number // vị trí con trỏ
  query: string
}

// @ đang gõ tại con trỏ; cùng quy tắc ký tự đứng trước với server (bỏ qua email, URL)
const ACTIVE_RE = /(^|[^a-zA-Z0-9_@./])@([\p{L}\p{N}_]{0,30})$/u

export function getActiveMention(text: string, caret: number): ActiveMention | null {
  const m = ACTIVE_RE.exec(text.slice(0, caret))
  if (!m) return null
  return { start: caret - m[2].length - 1, end: caret, query: m[2] }
}

// Chèn @username thay cho từ đang gõ; trả về nội dung + vị trí con trỏ mới
export function insertMention(text: string, active: ActiveMention, username: string) {
  const after = text.slice(active.end).replace(/^[\p{L}\p{N}_]+/u, '') // nuốt phần còn lại của từ
  const token = `@${username}${after.startsWith(' ') ? '' : ' '}`
  return { text: text.slice(0, active.start) + token + after, caret: active.start + token.length }
}

// So khớp phía client (bỏ dấu): tiền tố username hoặc tiền tố một từ trong tên
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()

export function matchesCandidate(c: MentionCandidate, query: string): boolean {
  if (!query) return true
  const q = fold(query)
  return (
    fold(c.username).startsWith(q) ||
    fold(c.displayName)
      .split(/\s+/)
      .some((w) => w.startsWith(q))
  )
}

export const MENTION_REASON_LABEL: Record<MentionCandidate['reason'], string | null> = {
  author: 'Tác giả bài viết',
  participant: 'Đã bình luận',
  following: 'Đang theo dõi',
  other: null
}
