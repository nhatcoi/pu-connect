// Danh sách origin được phép (CORS HTTP + WebSocket handshake)
// Allowed origins: APP_URL + ADMIN_URL + CORS_ORIGINS (comma-separated) + localhost khi dev
function allowedOrigins(): Set<string> {
  const list = [
    process.env.APP_URL,
    process.env.ADMIN_URL || 'https://admin-puc.vnhat.dev',
    ...(process.env.CORS_ORIGINS || '').split(',')
  ]
  if (process.env.NODE_ENV !== 'production') {
    list.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001')
  }
  return new Set(list.map((o) => o?.trim().replace(/\/$/, '')).filter((o): o is string => !!o))
}

// Không có Origin (app mobile, curl, request cùng origin qua proxy) ⇒ cho phép;
// cookie session vẫn là lớp xác thực chính
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  return allowedOrigins().has(origin.replace(/\/$/, ''))
}
