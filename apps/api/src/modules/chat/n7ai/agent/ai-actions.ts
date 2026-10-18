import type { AiAction } from '@pu/schemas'

// Nút dưới câu trả lời N7AI: model ghi dòng đánh dấu sau dấu mốc (cùng 1 lượt gọi, không tốn thêm request)
//   "[mở] <nhãn> | /đường-dẫn"      ⇒ nút mở trang trong app
//   "[tham gia] <id nhóm học>"      ⇒ nút "Tham gia nhóm …" (người dùng bấm = xác nhận; N7AI không tự làm)
// Server kiểm từng dòng (đường dẫn thuộc app, nhóm còn nhận người) rồi mới lưu meta.actions

export const MAX_ACTIONS = 3
const MAX_LABEL = 48
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ACTION_LINE = /^\s*\[(mở|tham gia)\]\s*/i

// Trang được phép dẫn tới (đường dẫn tương đối của chính app; không host ngoài, không javascript:)
const ROUTES = [
  /^\/$/,
  /^\/(home|search|communities|courses|tools|messages|notifications|settings)$/,
  /^\/courses\/[A-Za-z0-9._-]{1,30}$/,
  /^\/c\/[a-z0-9-]{1,100}$/,
  new RegExp(`^/post/${UUID}$`, 'i'),
  new RegExp(`^/tools/(flashcards|quiz)(/${UUID})?$`, 'i'),
  new RegExp(`^/n7ai(/(library|settings(/[a-z-]{1,30})?|${UUID}))?$`, 'i'),
  /^\/settings\/[a-z-]{1,30}$/,
  /^\/[A-Za-z0-9._]{3,30}$/ // hồ sơ /<username>
]
const SEARCH_PARAMS = new Set(['q', 'type'])

// Chuẩn hóa & kiểm đường dẫn; /search chỉ giữ q, type
export function safeAppHref(raw: string): string | null {
  const href = raw.trim()
  if (!href.startsWith('/') || href.startsWith('//') || href.length > 200) return null
  let url: URL
  try {
    url = new URL(href, 'https://app.local')
  } catch {
    return null
  }
  if (url.origin !== 'https://app.local' || url.hash) return null
  if (url.pathname === '/search') {
    const params = new URLSearchParams()
    for (const [k, v] of url.searchParams) if (SEARCH_PARAMS.has(k) && v.length <= 100) params.set(k, v)
    const qs = params.toString()
    return qs ? `/search?${qs}` : '/search'
  }
  if (url.search) return null
  return ROUTES.some((r) => r.test(url.pathname)) ? url.pathname : null
}

export type ActionDraft = { kind: 'link'; label: string; href: string } | { kind: 'join_group'; id: string }

// Đọc dòng [mở] / [tham gia] trong phần sau dấu mốc (chưa kiểm nhóm học)
export function parseActionLines(tail: string): ActionDraft[] {
  const out: ActionDraft[] = []
  for (const line of tail.split('\n')) {
    const m = ACTION_LINE.exec(line)
    if (!m) continue
    const body = line.slice(m[0].length).trim()
    if (m[1].toLowerCase() === 'mở') {
      const [label, rawHref] = body.split('|').map((s) => s.trim())
      const href = rawHref ? safeAppHref(rawHref) : null
      if (label && href) out.push({ kind: 'link', label: label.replace(/\*\*/g, '').slice(0, MAX_LABEL), href })
    } else {
      const id = new RegExp(`^${UUID}$`, 'i').exec(body)?.[0]
      if (id) out.push({ kind: 'join_group', id: id.toLowerCase() })
    }
  }
  const seen = new Set<string>()
  return out.filter((a) => {
    const key = a.kind === 'link' ? a.href : a.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export type JoinableGroup = { id: string; name: string; courseCode: string | null }

// Nhóm hợp lệ ⇒ nút có nhãn & link học phần; loại nhóm không còn nhận người / mình đã ở trong
export function toActions(drafts: ActionDraft[], joinable: Map<string, JoinableGroup>): AiAction[] {
  const actions: AiAction[] = []
  for (const d of drafts) {
    if (d.kind === 'link') actions.push(d)
    else {
      const g = joinable.get(d.id)
      if (g) actions.push({ kind: 'join_group', id: g.id, label: `Tham gia nhóm ${g.name}`.slice(0, 80), href: g.courseCode ? `/courses/${g.courseCode}` : '/courses' })
    }
  }
  return actions.slice(0, MAX_ACTIONS)
}
