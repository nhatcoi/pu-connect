// Đường dẫn không gian PU AI (/puai) — tách khỏi Tin nhắn (/messages)
export const PUAI_HOME = '/puai'
export const PUAI_LIBRARY = '/puai/library'

export const puaiThreadHref = (id: string, messageId?: string) => `/puai/${id}${messageId ? `?m=${messageId}` : ''}`
export const puaiSettingsHref = (item?: string) => (item ? `/puai/settings/${item}` : '/puai/settings')

export const isPuaiPath = (pathname: string) => pathname === PUAI_HOME || pathname.startsWith(`${PUAI_HOME}/`)
