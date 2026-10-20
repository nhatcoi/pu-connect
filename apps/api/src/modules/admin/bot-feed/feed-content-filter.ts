import { createHash } from 'node:crypto'

// Từ khóa bị loại: tố cáo/bóc phốt cá nhân, tìm người yêu… (không đăng lại nội dung chưa kiểm chứng về một người)
const BLOCKED = ['bóc phốt', 'phốt', 'tố cáo', 'lừa đảo', 'scam', 'biến thái', 'đánh nhau', 'quấy rối', 'crush', 'tìm người yêu', 'xin sdt', 'xin số']
const MIN_LENGTH = 40
const MAX_LENGTH = 3000

const FB_LINK = /https?:\/\/(?:[\w-]+\.)?(?:facebook\.com|fb\.com|fb\.me|fb\.watch|messenger\.com)\S*/gi
const PHONE = /(?:\+?84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g
const PLATE = /\b\d{2}[A-Z]{1,2}[-\s]?\d{3}\.?\d{2}\b/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g

export type FeedFilterResult = { content: string; hash: string } | { reason: 'too_short' | 'too_long' | 'blocked_keyword' }

// Bỏ link Facebook, che SĐT/biển số/email, chuẩn hóa dòng trống
export function cleanFeedContent(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(FB_LINK, '')
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[SĐT]')
    .replace(PLATE, '[biển số]')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Băm theo nội dung đã chuẩn hóa (không dấu cách/dấu câu/hoa thường) ⇒ cùng nội dung chỉ khác định dạng vẫn bị coi là trùng
export function feedContentHash(content: string): string {
  const normalized = content
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '')
  return createHash('sha256').update(normalized).digest('hex')
}

export function filterFeedContent(raw: string): FeedFilterResult {
  const content = cleanFeedContent(raw)
  if (content.length < MIN_LENGTH) return { reason: 'too_short' }
  if (content.length > MAX_LENGTH) return { reason: 'too_long' }
  const lower = content.toLowerCase()
  if (BLOCKED.some((k) => lower.includes(k))) return { reason: 'blocked_keyword' }
  return { content, hash: feedContentHash(content) }
}
