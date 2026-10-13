// N7AI — không gian học AI của cùng hệ sinh thái (n7ai.vnhat.dev): tra Canvas, QLĐT qua extension
// Đổi bằng NEXT_PUBLIC_N7AI_URL (dùng khi build)
export const N7AI_URL = (process.env.NEXT_PUBLIC_N7AI_URL || 'https://n7ai.vnhat.dev').replace(/\/+$/, '')

// Route hash của N7AI: #/ai = cuộc trò chuyện mới
export const n7aiChatUrl = () => `${N7AI_URL}/#/ai`
