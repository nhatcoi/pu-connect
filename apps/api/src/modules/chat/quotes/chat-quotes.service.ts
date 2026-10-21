import { Injectable } from '@nestjs/common'
import type { ChatQuote, SendMessageInput } from '@pu/schemas'
import type { Queryable } from '../chat-core.service'

// Đoạn trích người dùng bôi đen từ tài liệu để hỏi N7AI: chuẩn hóa chữ, chỉ giữ liên kết tới tài liệu của chính mình
// Selected passages sent with a question; sourceId survives only if the document belongs to the sender
@Injectable()
export class ChatQuotesService {
  async resolve(client: Queryable, userId: string, quotes: SendMessageInput['quotes']): Promise<ChatQuote[]> {
    if (!quotes?.length) return []
    const ids = [...new Set(quotes.flatMap((q) => (q.sourceId ? [q.sourceId] : [])))]
    const owned = ids.length
      ? new Set<string>((await client.query(`SELECT id FROM ai_sources WHERE id = ANY($1::uuid[]) AND user_id = $2`, [ids, userId])).rows.map((r) => r.id as string))
      : new Set<string>()
    return quotes.map((q) => ({
      title: q.title,
      text: q.text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n'),
      ...(q.locator ? { locator: q.locator } : {}),
      ...(q.sourceId && owned.has(q.sourceId) ? { sourceId: q.sourceId } : {})
    }))
  }
}
