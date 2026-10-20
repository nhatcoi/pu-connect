// Đường dẫn không gian N7AI (/n7ai) — tách khỏi Tin nhắn (/messages)
export const N7AI_HOME = '/n7ai'
export const N7AI_LIBRARY = '/n7ai/library'
export const N7AI_TEMPORARY = '/n7ai/temporary' // chat tạm: không lưu

export const n7aiThreadHref = (id: string, messageId?: string) => `/n7ai/${id}${messageId ? `?m=${messageId}` : ''}`
// Trang công khai của hội thoại được chia sẻ (không cần đăng nhập)
export const n7aiShareHref = (token: string) => `/share/${token}`
export const n7aiSettingsHref = (item?: string) => (item ? `/n7ai/settings/${item}` : '/n7ai/settings')

export const isN7AiPath = (pathname: string) => pathname === N7AI_HOME || pathname.startsWith(`${N7AI_HOME}/`)
