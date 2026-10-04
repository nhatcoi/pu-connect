// Username dành riêng cho bot/hệ thống/route — người dùng không được đăng ký
// Reserved for bots, system accounts and top-level routes
const RESERVED = new Set([
  'puai', 'pu_ai', 'ai', 'bot', 'admin', 'administrator', 'root', 'system', 'support', 'help',
  'phenikaa', 'puconnector', 'moderator', 'mod', 'staff', 'official', 'null', 'undefined',
  'home', 'search', 'communities', 'messages', 'notifications', 'settings', 'api', 'graphql',
  'verify-email', 'get-started', 'c', 'u', 'login', 'logout', 'register', 'signup'
])

export function isReservedUsername(username: string): boolean {
  const u = username.toLowerCase().trim()
  return RESERVED.has(u) || u.startsWith('pu_') || u.startsWith('puai')
}
