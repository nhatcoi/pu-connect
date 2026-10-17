// Đường dẫn không gian N7AI (/n7ai) — tách khỏi Tin nhắn (/messages)
export const N7AI_HOME = '/n7ai'
export const N7AI_LIBRARY = '/n7ai/library'

export const n7aiThreadHref = (id: string, messageId?: string) => `/n7ai/${id}${messageId ? `?m=${messageId}` : ''}`
export const n7aiSettingsHref = (item?: string) => (item ? `/n7ai/settings/${item}` : '/n7ai/settings')

export const isN7AiPath = (pathname: string) => pathname === N7AI_HOME || pathname.startsWith(`${N7AI_HOME}/`)
