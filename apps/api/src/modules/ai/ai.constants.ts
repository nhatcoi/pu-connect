// Gọi PU AI bằng @puai trong tin nhắn nhóm / bình luận
export const PUAI_MENTION = /(^|\s)@puai\b/i

export const stripPuaiMention = (text: string) => text.replace(/@puai\b/gi, '').trim()

export type AiTrigger = 'dm' | 'mention' | 'comment' | 'summary'
export type AiRef = { type: 'message' | 'comment' | 'post'; id: string }
