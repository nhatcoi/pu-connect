// Gọi N7AI bằng @n7ai trong tin nhắn nhóm / bình luận
// Tên cũ @puai (trước 2026-10-17) vẫn gọi được
export const N7AI_MENTION = /(^|\s)@(?:n7ai|puai)\b/i

export const stripN7AiMention = (text: string) => text.replace(/@(?:n7ai|puai)\b/gi, '').trim()

export type AiTrigger = 'dm' | 'mention' | 'comment' | 'summary' | 'skill' | 'tool' | 'document'
export type AiRef = { type: 'message' | 'comment' | 'post' | 'document'; id: string }
