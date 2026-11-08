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
