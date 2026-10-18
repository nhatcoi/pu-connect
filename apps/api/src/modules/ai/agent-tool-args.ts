// Tham số tool do model sinh = dữ liệu không tin cậy ⇒ kiểm & giới hạn trước khi đưa vào SQL
// Tool arguments come from the model: validate, clamp and escape before use

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const argText = (v: unknown, max = 100): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
export const argUuid = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null)
export const argInt = (v: unknown, min: number, max: number, fallback: number): number =>
  Number.isInteger(v) ? Math.min(max, Math.max(min, v as number)) : fallback
export const argEnum = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (allowed.includes(v as T) ? (v as T) : null)

// Từ khóa (thường, ≤ 6 từ, đã escape cho LIKE) để khớp "đủ mọi từ" trên cột đã unaccent
export function likeTerms(q: string | null): string[] {
  if (!q) return []
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 6)
    .map((w) => w.replace(/[%_\\]/g, (c) => `\\${c}`))
}

// Kết quả tool dạng JSON, cắt khi quá dài (model được nhắc lọc hẹp lại)
export function toolResult(provider: string, data: unknown, maxChars = 12_000): string {
  const out = JSON.stringify({ provider, data })
  return out.length <= maxChars
    ? out
    : JSON.stringify({ provider, truncated: true, data: out.slice(0, maxChars - 512), note: 'Kết quả dài, lọc hẹp hơn để đọc tiếp' })
}

export const toolError = (message: string) => JSON.stringify({ error: message })
