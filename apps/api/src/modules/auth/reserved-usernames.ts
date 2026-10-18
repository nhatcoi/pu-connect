// Username dành riêng cho bot/hệ thống/route — người dùng không được đăng ký
// Reserved for bots, system accounts and top-level routes
const RESERVED = new Set([
  'n7ai',
  'n7_ai',
  'puai', // tên cũ của bot
  'pu_ai',
  'ai',
  'bot',
  'all',
  'everyone',
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'phenikaa',
  'puconnector',
  'moderator',
  'mod',
  'staff',
  'official',
  'null',
  'undefined',
  'home',
  'search',
  'communities',
  'messages',
  'notifications',
  'settings',
  'api',
  'graphql',
  'verify-email',
  'get-started',
  'post',
  'share',
  'p',
  'c',
  'u',
  'login',
  'logout',
  'register',
  'signup'
])

export function isReservedUsername(username: string): boolean {
  const u = username.toLowerCase().trim()
  return RESERVED.has(u) || u.startsWith('pu_') || u.startsWith('n7ai') || u.startsWith('puai')
}
