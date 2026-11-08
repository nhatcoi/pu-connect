// Quyền của API key. Key chỉ làm được những gì scope cho phép, và không bao giờ đụng vào
// tài khoản (đăng nhập, mật khẩu, hồ sơ), quản trị, hay chính danh sách key.
export const API_KEY_SCOPES = ['read', 'write', 'documents', 'ai'] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

export const API_KEY_MAX_PER_USER = 10
export const API_KEY_PREFIX = 'puk_'

// Đường dẫn (sau /api) key không được gọi, dù scope nào
const DENIED = /^(auth|api-keys|admin|push|storage|graphql)(\/|$)|^users\/(profile|privacy|preferences|verify-university)(\/|$)/

// Ghi: bài viết, bình luận, cộng đồng, học phần, thông báo
const WRITE_PREFIX = /^(posts|comments|communities|courses|notifications)(\/|$)/
const DOCUMENTS_PREFIX = /^documents(\/|$)/
const AI_PREFIX = /^ai(\/|$)/
// Hỏi đáp AI nằm cạnh tài nguyên khác nhưng tính hạn mức AI ⇒ cần scope ai
const AI_ACTIONS = /^(communities\/[^/]+\/ask|posts\/[^/]+\/summary|documents\/[^/]+\/(summarize|study-draft|suggest))$/

export function apiKeyAllows(scopes: readonly string[], method: string, rawPath: string): boolean {
  const path = rawPath.replace(/^\/+/, '').replace(/\/+$/, '').split('?')[0]
  if (DENIED.test(path)) return false
  const has = (s: ApiKeyScope) => scopes.includes(s)
  const isRead = method === 'GET' || method === 'HEAD'
  if (AI_ACTIONS.test(path)) return has('ai')
  if (AI_PREFIX.test(path)) return has('ai')
  if (DOCUMENTS_PREFIX.test(path) && !isRead) return has('documents')
  if (isRead) return has('read') || has('write') || has('documents') || has('ai')
  return has('write') && WRITE_PREFIX.test(path)
}

// ── Key admin (pka_): chỉ dùng cho /api/admin/* và /api/mcp/admin, quyền tối đa = quyền RBAC của chính admin ──
export const ADMIN_KEY_SCOPES = ['admin_read', 'admin_moderate', 'admin_users', 'admin_academic'] as const
export type AdminKeyScope = (typeof ADMIN_KEY_SCOPES)[number]
export const ADMIN_KEY_PREFIX = 'pka_'
export const ADMIN_KEY_MAX_DAYS = 30
export type ApiKeyKind = 'user' | 'admin'

const UUID = '[0-9a-f-]{36}'
const rx = (s: string) => new RegExp(`^admin/${s}$`)
// Đọc: không gồm xuất CSV người dùng, danh sách phiên đăng nhập, cài đặt hệ thống, push
const ADMIN_READ = [
  'me', 'stats', 'reports', 'posts', 'comment-reports', 'comments', 'users', 'users/summary', `users/${UUID}`, `users/${UUID}/(insight|activity|security)`,
  'ai/overview', 'ai/skills', 'courses', 'documents', 'communities', 'search/(zero-results|top)', 'audit-logs', 'security-events', 'user-reports',
  'ops/(trends|inbox|verification|sanctions|study-groups|events|chat|connectors|health|storage)'
].map(rx)
type Rule = readonly [string, RegExp]
const rules = (list: [string, string][]): Rule[] => list.map(([m, p]) => [m, rx(p)] as const)
const ADMIN_MODERATE = rules([
  ['POST', `posts/${UUID}/(hide|unhide|pin|dismiss-reports)`],
  ['DELETE', `comments/${UUID}`],
  ['POST', 'user-reports/resolve'],
  ['POST', `communities/${UUID}/(approve|reject)`],
  ['POST', `ops/chat/messages/${UUID}/resolve`]
])
const ADMIN_USERS = rules([
  ['POST', `users/${UUID}/(suspend|unsuspend|sanctions|notes)`],
  ['DELETE', `users/${UUID}/sanctions/\\d+`],
  ['PATCH', `users/${UUID}/verify`]
])
const ADMIN_ACADEMIC = rules([
  ['POST', 'courses'],
  ['PATCH', `courses/${UUID}`],
  ['PATCH', `ops/study-groups/${UUID}/status`]
])

// Allow-list: mọi thứ không nằm trong danh sách (đổi vai trò, xóa người dùng, khóa AI, quản lý key, thùng rác, cài đặt…) đều bị từ chối
export function adminKeyAllows(scopes: readonly string[], method: string, rawPath: string): boolean {
  const path = rawPath.replace(/^\/+/, '').replace(/\/+$/, '').split('?')[0]
  const has = (s: AdminKeyScope) => scopes.includes(s)
  if (method === 'GET' || method === 'HEAD') return ADMIN_READ.some((r) => r.test(path)) && ADMIN_KEY_SCOPES.some(has)
  const hit = (list: Rule[]) => list.some(([m, r]) => m === method && r.test(path))
  return (has('admin_moderate') && hit(ADMIN_MODERATE)) || (has('admin_users') && hit(ADMIN_USERS)) || (has('admin_academic') && hit(ADMIN_ACADEMIC))
}
